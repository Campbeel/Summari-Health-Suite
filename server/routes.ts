import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { isAuthenticated, registerAuthRoutes, requireRole } from "./auth";
import { createPayment, getPaymentStatus, isPaymentSuccessful, getPaymentStatusText, verifyFlowSignature } from "./flow";
import { transcribeAudio, transcribeAudioChunked, generatePrescriptionFromTranscript, generateFullConsultationSuggestions, generateMedicalReport, generateMedicalReportWithTemplate, DEFAULT_REPORT_TEMPLATE_PROMPT, generateClinicalAlerts, generateAssistantWelcome, chatWithAssistant, generatePatientHistorySummary, type AssistantContext, type PastConsultationInput } from "./openai";
import { sendConsultationDocuments, sendPaymentReceiptEmail } from "./email";
import { generateConsultationPdf, generateSeparateConsultationPdfs, generatePaymentReceiptPdf, type PdfDocumentData, type ReceiptPdfData } from "./pdf-generator";
import { getFitbitAuthUrl, getAndRemovePendingState, exchangeCodeForTokens, refreshFitbitTokens, fetchFitbitData } from "./fitbit";
import {
  insertPatientSchema,
  insertAppointmentSchema,
  insertClinicalRecordSchema,
  insertPrescriptionSchema,
  insertMedicalInstructionSchema,
  insertDoctorSchema,
  insertOrganizationSchema,
  organizations,
  users,
  doctors,
  patients,
  appointments,
  residentCareTasks,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql as dsql, inArray, desc as ddesc, sql } from "drizzle-orm";
import { getTaskUrgency, sortByUrgency } from "@shared/care-tasks";
import bcrypt from "bcryptjs";

// WebRTC signaling room management
interface WaitingEntry {
  ws: WebSocket;
  userId: string;
  patientName: string;
}
interface SignalingRoom {
  participants: Map<string, WebSocket>;
  waitingPatients: Map<string, WaitingEntry>;
  doctorUserId?: string;
}
const signalingRooms = new Map<string, SignalingRoom>();


function log(message: string, source = "webrtc") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  registerAuthRoutes(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(401).json({ error: "Sesión inválida" });
      }

      const isCareStaff =
        user.role === "staff" || user.role === "doctor" || user.role === "admin";

      let patient = null;
      if (!isCareStaff) {
        patient = await storage.getPatientByUserId(userId);
        if (!patient) {
          patient = await storage.createPatient({ userId });
        }
      }

      const { passwordHash, ...safeUser } = user;
      res.json({ user: safeUser, patient });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Doctors directory — used by patients to browse and book consultations.
  // Requires authentication: the directory is private to platform users, not the public internet.
  app.get("/api/doctors", isAuthenticated, async (req, res) => {
    try {
      const doctors = await storage.getAllDoctors();
      res.json(doctors);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      res.status(500).json({ error: "Failed to fetch doctors" });
    }
  });

  // CIMA (AEMPS) medication catalog proxy. Public, free, Spanish-language. We proxy to avoid CORS,
  // cache short-term to be a polite client, and project down to the fields the autocomplete needs.
  // If we ever switch to Vidal Vademecum, this is the only endpoint that changes shape.
  const cimaCache = new Map<string, { at: number; data: unknown }>();
  const CIMA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  app.get("/api/drugs/search", isAuthenticated, async (req, res) => {
    try {
      const raw = (req.query.q as string | undefined)?.trim() || "";
      if (raw.length < 3) return res.json({ results: [], source: "cima" });
      const cacheKey = raw.toLowerCase();
      const cached = cimaCache.get(cacheKey);
      if (cached && Date.now() - cached.at < CIMA_CACHE_TTL_MS) {
        return res.json(cached.data);
      }
      const url = `https://cima.aemps.es/cima/rest/medicamentos?nombre=${encodeURIComponent(raw)}&pagina=1`;
      const upstream = await fetch(url, { headers: { Accept: "application/json" } });
      if (!upstream.ok) {
        return res.status(502).json({ error: "Catálogo no disponible", results: [] });
      }
      const json = (await upstream.json()) as any;
      const resultados: any[] = Array.isArray(json?.resultados) ? json.resultados : [];
      const results = resultados.slice(0, 15).map((m) => ({
        id: m?.nregistro || m?.cn || String(m?.nombre || ""),
        name: String(m?.nombre || "").trim(),
        activeIngredient: String(m?.pactivos || "").trim() || null,
        labHolder: String(m?.labtitular || "").trim() || null,
      }));
      const payload = { results, source: "cima" as const };
      cimaCache.set(cacheKey, { at: Date.now(), data: payload });
      res.json(payload);
    } catch (error) {
      console.error("Error querying CIMA:", error);
      res.status(502).json({ error: "Catálogo no disponible", results: [] });
    }
  });

  // Doctor (current user) routes - must be before :id routes to prevent "me" being matched as an id
  app.get("/api/doctors/me", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const userId = req.userId;
      const doctor = await storage.getDoctorByUserId(userId);
      
      if (!doctor) {
        return res.status(403).json({ error: "User is not a doctor" });
      }
      
      const user = await storage.getUser(userId);
      res.json({
        ...doctor,
        userName: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email,
        userImage: user?.profileImageUrl,
      });
    } catch (error) {
      console.error("Error fetching doctor profile:", error);
      res.status(500).json({ error: "Failed to fetch doctor profile" });
    }
  });

  app.get("/api/doctors/me/stats", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const userId = req.userId;
      const doctor = await storage.getDoctorByUserId(userId);
      
      if (!doctor) {
        return res.status(403).json({ error: "User is not a doctor" });
      }
      
      const stats = await storage.getDoctorDashboardStats(doctor.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching doctor stats:", error);
      res.status(500).json({ error: "Failed to fetch doctor stats" });
    }
  });

  app.get("/api/doctors/me/appointments", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const userId = req.userId;
      const doctor = await storage.getDoctorByUserId(userId);
      
      if (!doctor) {
        return res.status(403).json({ error: "User is not a doctor" });
      }
      
      const appointments = await storage.getAppointmentsByDoctorWithPatient(doctor.id);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching doctor appointments:", error);
      res.status(500).json({ error: "Failed to fetch doctor appointments" });
    }
  });

  app.patch("/api/doctors/me/profile", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const userId = req.userId;
      const doctor = await storage.getDoctorByUserId(userId);
      
      if (!doctor) {
        return res.status(403).json({ error: "User is not a doctor" });
      }
      
      const allowedFields = z.object({
        bio: z.string().optional(),
        consultationFee: z.number().optional(),
        consultationDuration: z.number().optional(),
        profileImageUrl: z.string().optional(),
      }).partial();
      const validationResult = allowedFields.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const { profileImageUrl, ...doctorFields } = validationResult.data;

      if (profileImageUrl !== undefined) {
        await storage.updateUser(userId, { profileImageUrl });
      }

      const updated = await storage.updateDoctorProfile(doctor.id, doctorFields);
      res.json(updated);
    } catch (error) {
      console.error("Error updating doctor profile:", error);
      res.status(500).json({ error: "Failed to update doctor profile" });
    }
  });

  app.patch("/api/doctors/me/availability", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const userId = req.userId;
      const doctor = await storage.getDoctorByUserId(userId);
      
      if (!doctor) {
        return res.status(403).json({ error: "User is not a doctor" });
      }
      
      const availabilitySchema = z.object({
        availability: z.record(z.string(), z.array(z.object({
          start: z.string(),
          end: z.string(),
        }))).nullable(),
      });
      
      const validationResult = availabilitySchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const updated = await storage.updateDoctorProfile(doctor.id, { availability: validationResult.data.availability });
      res.json(updated);
    } catch (error) {
      console.error("Error updating doctor availability:", error);
      res.status(500).json({ error: "Failed to update doctor availability" });
    }
  });

  app.patch("/api/appointments/:id/status", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;
      
      const statusSchema = z
        .object({
          status: z.enum(["confirmed", "cancelled", "in_progress", "completed"]),
          cancellationReason: z.string().trim().min(3).max(500).optional(),
        })
        .superRefine((val, ctx) => {
          if (val.status === "cancelled" && !val.cancellationReason) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["cancellationReason"],
              message: "El motivo de cancelación es obligatorio (mínimo 3 caracteres).",
            });
          }
        });

      const validationResult = statusSchema.safeParse(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor || doctor.id !== appointment.doctorId) {
        return res.status(403).json({ error: "Not authorized to update this appointment" });
      }

      const updated = await storage.updateAppointmentStatus(
        appointmentId,
        validationResult.data.status,
        validationResult.data.status === "cancelled" ? validationResult.data.cancellationReason : undefined,
      );
      res.json(updated);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ error: "Failed to update appointment status" });
    }
  });

  app.get("/api/doctors/me/patients", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const search = (req.query.rut as string) || (req.query.search as string) || undefined;
      const patients = await storage.getAllPatients(search);
      res.json(patients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  app.get("/api/staff/dashboard", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const userId = req.userId as string;
      const user = await storage.getUser(userId);
      const assignedPatients = await storage.getAssignedPatientsForStaff(userId);
      const allPatients = await storage.getAllPatients();
      const now = new Date();

      const rawTasks = await storage.getAllPendingResidentCareTasks();
      const pendingTasks = sortByUrgency(
        rawTasks.map((t) => ({
          id: t.id,
          text: t.text,
          dueAt: t.dueAt.toISOString(),
          patientId: t.patientId,
          patientName: t.patientName,
          rut: t.rut,
          createdByName: t.createdByName,
          urgency: getTaskUrgency(t.dueAt.toISOString(), now),
        })),
        now,
      );

      const taskStats = {
        critical: pendingTasks.filter((t) => t.urgency === "critical").length,
        warning: pendingTasks.filter((t) => t.urgency === "warning").length,
        normal: pendingTasks.filter((t) => t.urgency === "normal").length,
      };

      res.json({
        greeting: `Hola${user?.firstName ? `, ${user.firstName}` : ""}`,
        dateLabel: now.toLocaleDateString("es-CL", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        timeLabel: now.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        stats: {
          totalResidents: allPatients.length,
          assignedResidents: assignedPatients.length,
          pendingTasks: pendingTasks.length,
          criticalTasks: taskStats.critical,
          warningTasks: taskStats.warning,
        },
        pendingTasks,
        taskStats,
        assignedResidents: assignedPatients.slice(0, 6).map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          rut: p.rut,
        })),
        recentResidents: allPatients.slice(0, 6).map((p) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          rut: p.rut,
        })),
      });
    } catch (error) {
      console.error("Error fetching staff dashboard:", error);
      res.status(500).json({ error: "Failed to load dashboard" });
    }
  });

  app.get("/api/staff/patients/:patientId/care", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) return res.status(400).json({ error: "ID inválido" });
      const profile = await storage.getPatientFullProfile(patientId);
      if (!profile) return res.status(404).json({ error: "Paciente no encontrado" });
      let session = await storage.getStaffCareSession(patientId, req.userId);
      if (!session) {
        session = await storage.upsertStaffCareSession({
          patientId,
          staffUserId: req.userId,
          anamnesis: profile.medicalHistory || "",
          pendingTasks: [],
        });
      }
      res.json({ profile, session });
    } catch (error) {
      console.error("Error fetching care session:", error);
      res.status(500).json({ error: "Failed to load care session" });
    }
  });

  app.put("/api/staff/patients/:patientId/care", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) return res.status(400).json({ error: "ID inválido" });
      const profile = await storage.getPatientFullProfile(patientId);
      if (!profile) return res.status(404).json({ error: "Paciente no encontrado" });

      const schema = z.object({
        anamnesis: z.string().optional(),
        pendingTasks: z.array(z.object({
          id: z.string(),
          text: z.string(),
          resolved: z.boolean(),
          createdAt: z.string(),
        })).optional(),
        newTaskText: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

      let pendingTasks = parsed.data.pendingTasks;
      const existing = await storage.getStaffCareSession(patientId, req.userId);
      if (!pendingTasks) pendingTasks = existing?.pendingTasks || [];
      if (parsed.data.newTaskText?.trim()) {
        pendingTasks = [
          ...pendingTasks,
          {
            id: crypto.randomUUID(),
            text: parsed.data.newTaskText.trim(),
            resolved: false,
            createdAt: new Date().toISOString(),
          },
        ];
      }

      const session = await storage.upsertStaffCareSession({
        patientId,
        staffUserId: req.userId,
        anamnesis: parsed.data.anamnesis ?? existing?.anamnesis ?? "",
        pendingTasks,
      });

      if (parsed.data.anamnesis !== undefined) {
        await storage.updatePatient(patientId, { medicalHistory: parsed.data.anamnesis } as any);
      }

      res.json(session);
    } catch (error) {
      console.error("Error saving care session:", error);
      res.status(500).json({ error: "Failed to save" });
    }
  });

  app.post("/api/staff/patients/:patientId/care/complete", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const user = await storage.getUser(req.userId);
      const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Staff";
      const session = await storage.completeStaffCareSession(patientId, req.userId, name);
      if (!session) return res.status(404).json({ error: "No hay sesión activa" });
      res.json(session);
    } catch (error) {
      console.error("Error completing care:", error);
      res.status(500).json({ error: "Failed to complete" });
    }
  });

  app.get("/api/staff/patients/:patientId/tasks", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) return res.status(400).json({ error: "ID inválido" });
      const profile = await storage.getPatientFullProfile(patientId);
      if (!profile) return res.status(404).json({ error: "Residente no encontrado" });
      const tasks = await storage.getResidentCareTasks(patientId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching resident tasks:", error);
      res.status(500).json({ error: "Failed to load tasks" });
    }
  });

  app.post("/api/staff/patients/:patientId/tasks", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId)) return res.status(400).json({ error: "ID inválido" });
      const profile = await storage.getPatientFullProfile(patientId);
      if (!profile) return res.status(404).json({ error: "Residente no encontrado" });

      const schema = z.object({
        text: z.string().min(1).max(500),
        dueAt: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

      const user = await storage.getUser(req.userId);
      const createdByName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Staff";
      const dueAt = new Date(parsed.data.dueAt);
      if (Number.isNaN(dueAt.getTime())) return res.status(400).json({ error: "Fecha de vencimiento inválida" });

      const task = await storage.createResidentCareTask({
        patientId,
        text: parsed.data.text.trim(),
        dueAt,
        createdByUserId: req.userId,
        createdByName,
      });

      await storage.upsertStaffCareSession({
        patientId,
        staffUserId: req.userId,
        anamnesis: profile.medicalHistory || "",
      });

      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating resident task:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  app.patch("/api/staff/patients/:patientId/tasks/:taskId", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      if (isNaN(taskId)) return res.status(400).json({ error: "ID inválido" });

      const schema = z.object({ resolved: z.boolean() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

      const user = await storage.getUser(req.userId);
      const name = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Staff";

      const task = parsed.data.resolved
        ? await storage.resolveResidentCareTask(taskId, req.userId, name)
        : await storage.unresolveResidentCareTask(taskId);

      if (!task) return res.status(404).json({ error: "Tarea no encontrada" });
      res.json(task);
    } catch (error) {
      console.error("Error updating resident task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  async function buildPatientAssistantContext(patientId: number, staffUserId: string) {
    const patient = await storage.getPatientFullProfile(patientId);
    if (!patient) throw new Error("Patient not found");
    const staff = await storage.getUser(staffUserId);
    const patientName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Residente";
    const records = await storage.getClinicalRecordsByPatient(patientId);
    return {
      doctorName: `${staff?.firstName || ""} ${staff?.lastName || ""}`.trim() || "Staff",
      patientName,
      patientGender: patient.gender || undefined,
      patientAllergies: patient.allergies || undefined,
      patientMedicalHistory: patient.medicalHistory || undefined,
      isNewPatient: records.length === 0,
      previousConsultationsCount: records.length,
      previousConsultationsSummary: patient.medicalHistory || undefined,
    };
  }

  app.post("/api/staff/patients/:patientId/assistant/welcome", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const context = await buildPatientAssistantContext(patientId, req.userId);
      const message = await generateAssistantWelcome(context);
      res.json({ message });
    } catch (error) {
      console.error("Error patient assistant welcome:", error);
      res.status(500).json({ error: "Error al generar bienvenida" });
    }
  });

  app.post("/api/staff/patients/:patientId/assistant/chat", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const parsed = z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().min(1).max(2000),
        })).min(1).max(50),
      }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Mensajes inválidos" });
      const context = await buildPatientAssistantContext(patientId, req.userId);
      const message = await chatWithAssistant(parsed.data.messages, context);
      res.json({ message });
    } catch (error) {
      console.error("Error patient assistant chat:", error);
      res.status(500).json({ error: "Error en chat" });
    }
  });

  app.get("/api/doctors/me/patients/:patientId", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patient ID" });
      }
      const profile = await storage.getPatientFullProfile(patientId);
      if (!profile) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching patient profile:", error);
      res.status(500).json({ error: "Failed to fetch patient profile" });
    }
  });

  app.get("/api/doctors/me/patients/:patientId/history", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patient ID" });
      }
      const history = await storage.getPatientAppointmentHistory(patientId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching patient history:", error);
      res.status(500).json({ error: "Failed to fetch patient history" });
    }
  });

  app.get("/api/doctors/me/patients/:patientId/records", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patient ID" });
      }
      const records = await storage.getClinicalRecordsByPatient(patientId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching patient records:", error);
      res.status(500).json({ error: "Failed to fetch patient records" });
    }
  });

  app.get("/api/doctors/me/patients/:patientId/prescriptions", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patient ID" });
      }
      const prescriptions = await storage.getPrescriptionsByPatient(patientId);
      res.json(prescriptions);
    } catch (error) {
      console.error("Error fetching patient prescriptions:", error);
      res.status(500).json({ error: "Failed to fetch patient prescriptions" });
    }
  });

  app.get("/api/doctors/me/patients/:patientId/exam-orders", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patient ID" });
      }
      const examOrders = await storage.getExamOrdersWithDoctorByPatient(patientId);
      res.json(examOrders);
    } catch (error) {
      console.error("Error fetching patient exam orders:", error);
      res.status(500).json({ error: "Failed to fetch patient exam orders" });
    }
  });

  // T001: Doctor notifications (patient online + overtime)
  app.get("/api/doctors/me/notifications", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "User is not a doctor" });

      const notifications: Array<{
        id: string;
        type: 'patient_online' | 'patient_overtime' | 'patient_waiting';
        appointmentId: number;
        patientId: number;
        patientName: string;
        title: string;
        message: string;
        timestamp: string;
        link: string;
      }> = [];

      const upcoming = await storage.getUpcomingAppointmentsByDoctor(doctor.id);
      const now = Date.now();

      for (const apt of upcoming) {
        const roomId = `consultation-${apt.id}`;
        const room = signalingRooms.get(roomId);
        if (!room) continue;
        const patientOnline = room.waitingPatients.size > 0 || room.participants.size > 1;
        if (!patientOnline) continue;

        const patientName = apt.patientName || 'Paciente';
        
        const scheduledStart = new Date(`${apt.scheduledDate}T${apt.scheduledTime}`);
        const scheduledEndMs = scheduledStart.getTime() + (apt.durationMinutes || 30) * 60000;
        const isOvertime = apt.status === 'in_progress' && now > scheduledEndMs;
        const isWaiting = room.waitingPatients.size > 0;

        if (isOvertime) {
          notifications.push({
            id: `overtime-${apt.id}`,
            type: 'patient_overtime',
            appointmentId: apt.id,
            patientId: apt.patientId,
            patientName,
            title: 'Consulta fuera de tiempo',
            message: `La consulta con ${patientName} lleva más del tiempo estimado. Otro paciente puede estar esperándote.`,
            timestamp: new Date().toISOString(),
            link: `/consultation/${apt.id}`,
          });
        } else if (isWaiting) {
          notifications.push({
            id: `waiting-${apt.id}`,
            type: 'patient_waiting',
            appointmentId: apt.id,
            patientId: apt.patientId,
            patientName,
            title: 'Paciente en sala de espera',
            message: `${patientName} está conectado y esperando.`,
            timestamp: new Date().toISOString(),
            link: `/consultation/${apt.id}`,
          });
        } else {
          notifications.push({
            id: `online-${apt.id}`,
            type: 'patient_online',
            appointmentId: apt.id,
            patientId: apt.patientId,
            patientName,
            title: 'Paciente en línea',
            message: `${patientName} se ha conectado a la consulta.`,
            timestamp: new Date().toISOString(),
            link: `/consultation/${apt.id}`,
          });
        }
      }

      res.json(notifications);
    } catch (error: any) {
      console.error("Error fetching doctor notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  // T002: Chat history per patient
  app.get("/api/doctors/me/patients/:patientId/messages", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      if (isNaN(patientId) || patientId <= 0) {
        return res.status(400).json({ error: "Invalid patient ID" });
      }
      const doctor = await storage.getDoctorByUserId(req.userId);
      const messages = doctor
        ? await storage.getConsultationMessagesByPatientDoctor(doctor.id, patientId)
        : [];
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching patient messages:", error);
      res.status(500).json({ error: "Failed to fetch patient messages" });
    }
  });

  // T003: Document signing workflow - unsigned PDF generation per doc type
  async function verifyDoctorOwnsAppointment(userId: string, appointmentId: number) {
    const doctor = await storage.getDoctorByUserId(userId);
    if (!doctor) return { error: "User is not a doctor", status: 403 };
    const apt = await storage.getAppointment(appointmentId);
    if (!apt) return { error: "Appointment not found", status: 404 };
    if (apt.doctorId !== doctor.id) return { error: "Not authorized", status: 403 };
    return { doctor, appointment: apt };
  }

  async function buildDocPdfData(appointmentId: number, docType: 'prescription' | 'instructions' | 'exams'): Promise<PdfDocumentData | null> {
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) return null;
    const doctor = await storage.getDoctor(appointment.doctorId);
    const doctorUser = doctor ? await storage.getUser(doctor.userId) : null;
    const patient = await storage.getPatient(appointment.patientId);
    const patientUser = patient ? await storage.getUser(patient.userId) : null;
    const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
    if (!clinicalRecord || !doctor || !doctorUser || !patient || !patientUser) return null;

    const data: PdfDocumentData = {
      doctorName: `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim(),
      doctorSpecialty: doctor.specialty || 'Medicina General',
      doctorLicense: doctor.licenseNumber || undefined,
      patientName: `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Paciente',
      patientRut: patientUser.rut || undefined,
      consultationDate: appointment.scheduledDate
        ? new Date(appointment.scheduledDate).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
        : '',
      diagnosis: clinicalRecord.diagnosis || undefined,
      prescription: null,
      examOrders: null,
      documentTypes: [docType],
    };

    if (docType === 'prescription') {
      const p = await storage.getPrescriptionByRecordId(clinicalRecord.id);
      if (p && (p.medications as any[])?.length > 0) {
        data.prescription = { medications: p.medications as any, instructions: p.instructions };
      }
    } else if (docType === 'instructions') {
      const list = await storage.getInstructionsByRecordId(clinicalRecord.id);
      if (list.length > 0) {
        data.medicalInstructions = list.map(i => ({
          category: i.category, title: i.title, description: i.description, priority: i.priority,
        }));
      }
    } else if (docType === 'exams') {
      const orders = await storage.getExamOrdersByRecordId(clinicalRecord.id);
      if (orders.length > 0) {
        data.examOrders = { exams: orders[0].exams as any };
      }
    }
    return data;
  }

  // GET unsigned PDF for a document type, keyed by appointment
  app.get("/api/consultations/:id/unsigned-pdf/:docType", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const docType = req.params.docType as 'prescription' | 'instructions' | 'exams';
      if (!['prescription', 'instructions', 'exams'].includes(docType)) {
        return res.status(400).json({ error: "Invalid document type" });
      }
      const check = await verifyDoctorOwnsAppointment(req.userId, appointmentId);
      if ('error' in check) return res.status(check.status).json({ error: check.error });

      const data = await buildDocPdfData(appointmentId, docType);
      if (!data) return res.status(404).json({ error: "Documento no disponible" });

      const pdfs = await generateSeparateConsultationPdfs(data);
      const pdf = pdfs.find(p => p.type === docType);
      if (!pdf) return res.status(404).json({ error: "Documento no disponible para este tipo" });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
      res.send(pdf.buffer);
    } catch (error: any) {
      console.error("Error generating unsigned PDF:", error);
      res.status(500).json({ error: "Error al generar el PDF" });
    }
  });

  // POST signed PDF (base64) for a document type
  app.post("/api/consultations/:id/signed-pdf/:docType", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const docType = req.params.docType as 'prescription' | 'instructions' | 'exams';
      const { pdfBase64 } = req.body;
      if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        return res.status(400).json({ error: "pdfBase64 is required" });
      }
      if (!['prescription', 'instructions', 'exams'].includes(docType)) {
        return res.status(400).json({ error: "Invalid document type" });
      }
      const check = await verifyDoctorOwnsAppointment(req.userId, appointmentId);
      if ('error' in check) return res.status(check.status).json({ error: check.error });

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!clinicalRecord) return res.status(404).json({ error: "Registro clínico no encontrado" });

      const signedAt = new Date();
      if (docType === 'prescription') {
        const p = await storage.getPrescriptionByRecordId(clinicalRecord.id);
        if (!p) return res.status(404).json({ error: "Receta no encontrada" });
        await storage.updatePrescription(p.id, { signedPdfData: pdfBase64, signedAt, status: 'signed' });
      } else if (docType === 'instructions') {
        const list = await storage.getInstructionsByRecordId(clinicalRecord.id);
        if (list.length === 0) return res.status(404).json({ error: "Indicaciones no encontradas" });
        for (const i of list) {
          await storage.updateMedicalInstruction(i.id, { signedPdfData: pdfBase64, signedAt, status: 'signed' });
        }
      } else if (docType === 'exams') {
        const orders = await storage.getExamOrdersByRecordId(clinicalRecord.id);
        if (orders.length === 0) return res.status(404).json({ error: "Órdenes de exámenes no encontradas" });
        for (const o of orders) {
          await storage.updateExamOrder(o.id, { signedPdfData: pdfBase64, signedAt, status: 'signed' });
        }
      }
      res.json({ success: true, signedAt });
    } catch (error: any) {
      console.error("Error uploading signed PDF:", error);
      res.status(500).json({ error: "Error al subir el PDF firmado" });
    }
  });

  // GET signing status for documents in a consultation
  app.get("/api/consultations/:id/signing-status", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const check = await verifyDoctorOwnsAppointment(req.userId, appointmentId);
      if ('error' in check) return res.status(check.status).json({ error: check.error });

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!clinicalRecord) return res.json({ prescription: null, instructions: null, exams: null });

      const prescription = await storage.getPrescriptionByRecordId(clinicalRecord.id);
      const instructions = await storage.getInstructionsByRecordId(clinicalRecord.id);
      const examOrdersList = await storage.getExamOrdersByRecordId(clinicalRecord.id);

      res.json({
        prescription: prescription ? {
          exists: (prescription.medications as any[])?.length > 0,
          signed: !!(prescription as any).signedPdfData,
          signedAt: (prescription as any).signedAt || null,
        } : { exists: false, signed: false, signedAt: null },
        instructions: instructions.length > 0 ? {
          exists: true,
          signed: instructions.every(i => !!(i as any).signedPdfData),
          signedAt: (instructions[0] as any).signedAt || null,
        } : { exists: false, signed: false, signedAt: null },
        exams: examOrdersList.length > 0 && (examOrdersList[0].exams as any[])?.length > 0 ? {
          exists: true,
          signed: !!(examOrdersList[0] as any).signedPdfData,
          signedAt: (examOrdersList[0] as any).signedAt || null,
        } : { exists: false, signed: false, signedAt: null },
      });
    } catch (error: any) {
      console.error("Error fetching signing status:", error);
      res.status(500).json({ error: "Error al consultar estado de firmas" });
    }
  });

  // GET pending signatures across all consultations for the logged-in doctor
  app.get("/api/doctors/me/pending-signatures", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "User is not a doctor" });

      const appointmentsList = await storage.getAppointmentsByDoctorWithPatient(doctor.id);
      const pending: Array<{
        appointmentId: number;
        patientName: string;
        scheduledDate: string;
        scheduledTime: string;
        pendingDocs: Array<'prescription' | 'instructions' | 'exams'>;
        link: string;
      }> = [];

      for (const apt of appointmentsList) {
        if (!['pending_validation', 'completed'].includes(apt.status)) continue;
        const clinicalRecord = await storage.getClinicalRecordByAppointmentId(apt.id);
        if (!clinicalRecord) continue;

        const pendingDocs: Array<'prescription' | 'instructions' | 'exams'> = [];

        const prescription = await storage.getPrescriptionByRecordId(clinicalRecord.id);
        if (prescription && (prescription.medications as any[])?.length > 0 && !(prescription as any).signedPdfData) {
          pendingDocs.push('prescription');
        }

        const instructions = await storage.getInstructionsByRecordId(clinicalRecord.id);
        if (instructions.length > 0 && !instructions.every((i) => !!(i as any).signedPdfData)) {
          pendingDocs.push('instructions');
        }

        const examOrdersList = await storage.getExamOrdersByRecordId(clinicalRecord.id);
        if (examOrdersList.length > 0 && (examOrdersList[0].exams as any[])?.length > 0 && !(examOrdersList[0] as any).signedPdfData) {
          pendingDocs.push('exams');
        }

        if (pendingDocs.length > 0) {
          pending.push({
            appointmentId: apt.id,
            patientName: apt.patientName || 'Paciente',
            scheduledDate: apt.scheduledDate,
            scheduledTime: apt.scheduledTime,
            pendingDocs,
            link: `/staff/consultation/${apt.id}/validate`,
          });
        }
      }

      res.json(pending);
    } catch (error: any) {
      console.error("Error fetching pending signatures:", error);
      res.status(500).json({ error: "Error al consultar documentos pendientes" });
    }
  });

  app.get("/api/doctors/me/report-templates", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "User is not a doctor" });
      const templates = await storage.getReportTemplatesByDoctor(doctor.id);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching report templates:", error);
      res.status(500).json({ error: "Failed to fetch report templates" });
    }
  });

  app.get("/api/doctors/me/report-templates/default-prompt", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "User is not a doctor" });
      res.json({ prompt: DEFAULT_REPORT_TEMPLATE_PROMPT });
    } catch (error) {
      res.status(500).json({ error: "Failed to get default prompt" });
    }
  });

  app.post("/api/doctors/me/report-templates", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "User is not a doctor" });
      const { name, prompt, isDefault } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "Name is required" });
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) return res.status(400).json({ error: "Prompt is required" });
      if (name.trim().length > 200) return res.status(400).json({ error: "Name is too long" });
      const template = await storage.createReportTemplate({
        doctorId: doctor.id,
        name,
        prompt,
        isDefault: isDefault || false,
      });
      res.json(template);
    } catch (error) {
      console.error("Error creating report template:", error);
      res.status(500).json({ error: "Failed to create report template" });
    }
  });

  app.put("/api/doctors/me/report-templates/:templateId", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "User is not a doctor" });
      const templateId = parseInt(req.params.templateId);
      const existing = await storage.getReportTemplate(templateId);
      if (!existing || existing.doctorId !== doctor.id) {
        return res.status(404).json({ error: "Template not found" });
      }
      const { name, prompt, isDefault } = req.body;
      const updated = await storage.updateReportTemplate(templateId, { name, prompt, isDefault });
      res.json(updated);
    } catch (error) {
      console.error("Error updating report template:", error);
      res.status(500).json({ error: "Failed to update report template" });
    }
  });

  app.delete("/api/doctors/me/report-templates/:templateId", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "User is not a doctor" });
      const templateId = parseInt(req.params.templateId);
      const existing = await storage.getReportTemplate(templateId);
      if (!existing || existing.doctorId !== doctor.id) {
        return res.status(404).json({ error: "Template not found" });
      }
      await storage.deleteReportTemplate(templateId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting report template:", error);
      res.status(500).json({ error: "Failed to delete report template" });
    }
  });

  // Get doctor by ID - must be after /api/doctors/me routes
  app.get("/api/doctors/:id", async (req, res) => {
    try {
      const doctor = await storage.getDoctor(parseInt(req.params.id));
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      res.json(doctor);
    } catch (error) {
      console.error("Error fetching doctor:", error);
      res.status(500).json({ error: "Failed to fetch doctor" });
    }
  });

  // Patient registration status
  app.get("/api/patients/registration-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      let patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }
      const registered = !!(patient.rut && patient.email && patient.whatsapp);
      res.json({ registered, patient });
    } catch (error) {
      console.error("Error checking registration status:", error);
      res.status(500).json({ error: "Failed to check registration status" });
    }
  });

  // Patient routes
  app.get("/api/patients/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      let patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }
      
      res.json(patient);
    } catch (error) {
      console.error("Error fetching patient profile:", error);
      res.status(500).json({ error: "Failed to fetch patient profile" });
    }
  });

  app.put("/api/patients/profile", isAuthenticated, async (req: any, res) => {
    try {
      const profileUpdateSchema = insertPatientSchema.partial().extend({
        rut: z.string().regex(/^(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])$/, "Formato de RUT inválido").optional().or(z.literal("")),
        email: z.string().email("Correo electrónico inválido").optional().or(z.literal("")),
        whatsapp: z.string().regex(/^\+\d{8,15}$/, "Formato de WhatsApp inválido").optional().or(z.literal("")),
      });
      const validationResult = profileUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Datos inválidos",
          errors: validationResult.error.flatten(),
        });
      }
      
      const patientData = validationResult.data;
      const userId = req.userId;
      let patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }

      const cleanedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(patientData)) {
        if (value === "") {
          if (key === "rut") continue;
          cleanedData[key] = null;
        } else {
          cleanedData[key] = value;
        }
      }

      const userUpdates: Record<string, any> = {};
      if (cleanedData.email && cleanedData.email !== patient.email) {
        userUpdates.email = cleanedData.email;
      }
      if (cleanedData.whatsapp !== undefined && cleanedData.whatsapp !== patient.whatsapp) {
        userUpdates.whatsapp = cleanedData.whatsapp;
      }
      if (Object.keys(userUpdates).length > 0) {
        await storage.updateUser(userId, userUpdates);
      }

      const updated = await storage.updatePatient(patient.id, cleanedData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating patient profile:", error);
      res.status(500).json({ error: "No se pudo actualizar el perfil" });
    }
  });

  app.post("/api/patients", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body against patientSchema
      const validationResult = insertPatientSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const patientData = validationResult.data;
      const patient = await storage.createPatient(patientData);
      res.json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  // Appointments routes
  app.get("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const appointments = await storage.getAppointmentsByPatient(patient.id);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/upcoming", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const appointments = await storage.getUpcomingAppointments(patient.id);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching upcoming appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/booked-slots", isAuthenticated, async (req: any, res) => {
    try {
      const { doctorId, date } = req.query;
      if (!doctorId || !date) {
        return res.status(400).json({ error: "Se requiere doctorId y date" });
      }
      const slots = await storage.getBookedSlots(Number(doctorId), date as string);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching booked slots:", error);
      res.status(500).json({ error: "Error al obtener horarios ocupados" });
    }
  });

  app.get("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appointment = await storage.getAppointment(parseInt(req.params.id));
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ error: "Failed to fetch appointment" });
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ error: "Se requiere un email registrado en tu cuenta para procesar el pago. Actualiza tu perfil e intenta nuevamente." });
      }

      let patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }
      
      const bookingSchema = insertAppointmentSchema.omit({ patientId: true });
      const validationResult = bookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Datos de la cita inválidos",
          errors: validationResult.error.flatten(),
        });
      }
      
      const appointmentData = validationResult.data;

      const doctor = await storage.getDoctor(appointmentData.doctorId);
      if (!doctor) {
        return res.status(404).json({ error: "Médico no encontrado" });
      }
      if (doctor.isActive === false) {
        return res.status(400).json({ error: "Este médico no está disponible para nuevas consultas" });
      }
      if (doctor.organizationId) {
        const [docOrg] = await db.select().from(organizations).where(eq(organizations.id, doctor.organizationId));
        if (docOrg && docOrg.isActive === false) {
          return res.status(400).json({ error: "La organización de este médico no está activa" });
        }
      }

      // Overwrite duration from doctor's preference
      appointmentData.durationMinutes = doctor.consultationDuration;

      const hasConflict = await storage.hasConflictingAppointment(
        appointmentData.doctorId,
        appointmentData.scheduledDate,
        appointmentData.scheduledTime
      );
      if (hasConflict) {
        return res.status(409).json({ error: "Este horario ya está reservado para este médico. Por favor selecciona otro horario." });
      }
      
      const appointment = await storage.createAppointment({
        patientId: patient.id,
        ...appointmentData,
        status: "scheduled",
        paymentStatus: "pending",
      });

      const subject = `Consulta médica - ${doctor.specialty}`;
      const amount = doctor.consultationFee;

      try {
        const { token, url, commerceOrderID } = await createPayment(
          user.email,
          amount,
          appointment.id,
          subject
        );

        await storage.updateAppointment(appointment.id, {
          flowToken: token,
          flowCommerceOrderId: commerceOrderID,
          paymentStatus: "pending",
        });

        res.json({
          ...appointment,
          redirectUrl: `${url}?token=${token}`,
          flowToken: token,
          flowCommerceOrderId: commerceOrderID,
        });
      } catch (paymentError) {
        console.error("Error creating Flow payment:", paymentError);
        res.json({
          ...appointment,
          paymentError: "No se pudo iniciar el pago. Puedes intentar pagar desde tus citas.",
        });
      }
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ error: "No se pudo agendar la consulta. Intenta nuevamente." });
    }
  });

  app.patch("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body against partial appointmentSchema
      const validationResult = insertAppointmentSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const appointmentData = validationResult.data;
      const updated = await storage.updateAppointment(parseInt(req.params.id), appointmentData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating appointment:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  // Payment routes - Flow integration
  app.post("/api/appointments/:id/pay", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const appointment = await storage.getAppointment(appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }
      
      const doctor = await storage.getDoctor(appointment.doctorId);
      if (!doctor) {
        return res.status(404).json({ error: "Médico no encontrado" });
      }
      
      const user = await storage.getUser(req.userId);
      if (!user?.email) {
        return res.status(400).json({ error: "Se requiere un email para procesar el pago" });
      }
      
      const subject = `Consulta médica - ${doctor.specialty}`;
      // consultationFee is stored in CLP (not cents), send directly to Flow
      const amount = doctor.consultationFee;
      
      // Verify user owns this appointment
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient || appointment.patientId !== patient.id) {
        return res.status(403).json({ error: "No tienes permiso para pagar esta cita" });
      }
      
      // Prevent duplicate payments - check if already paid or payment in progress
      if (appointment.paymentStatus === "paid") {
        return res.status(400).json({ error: "Esta cita ya fue pagada" });
      }
      if (appointment.flowToken) {
        // Payment already initiated, redirect to existing payment
        const flowBaseUrl = process.env.FLOW_BASE_URL || "https://sandbox.flow.cl/api";
        return res.json({ 
          redirectUrl: `${flowBaseUrl.replace('/api', '')}/app/web/pay.php?token=${appointment.flowToken}`,
          token: appointment.flowToken,
          commerceOrderID: appointment.flowCommerceOrderId
        });
      }
      
      const { token, url, commerceOrderID } = await createPayment(
        user.email,
        amount,
        appointmentId,
        subject
      );
      
      await storage.updateAppointment(appointmentId, {
        flowToken: token,
        flowCommerceOrderId: commerceOrderID,
        paymentStatus: "pending",
      });
      
      res.json({ 
        redirectUrl: `${url}?token=${token}`,
        token,
        commerceOrderID
      });
    } catch (error) {
      console.error("Error creating Flow payment:", error);
      res.status(500).json({ 
        error: "Error al crear la sesión de pago",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  async function sendReceiptEmailForAppointment(appointmentId: number, paidAmount?: number): Promise<void> {
    console.log(`[Receipt] Preparing receipt email for appointment ${appointmentId}...`);
    const fullAppointment = await storage.getAppointment(appointmentId);
    if (!fullAppointment) {
      console.error(`[Receipt] Could not find appointment ${appointmentId} for receipt email`);
      return;
    }
    const patient = await storage.getPatient(fullAppointment.patientId);
    const patientUser = patient ? await storage.getUser(patient.userId) : null;
    const doctor = await storage.getDoctor(fullAppointment.doctorId);
    const doctorUser = doctor ? await storage.getUser(doctor.userId) : null;

    if (!patientUser?.email) {
      console.error(`[Receipt] Patient has no email for appointment ${appointmentId}`);
      return;
    }
    if (!doctorUser || !doctor) {
      console.error(`[Receipt] Doctor not found for appointment ${appointmentId}`);
      return;
    }

    const patientName = `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Paciente';
    const doctorName = `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim();
    const orderId = fullAppointment.flowCommerceOrderId || `APT-${appointmentId}`;
    const amount = paidAmount || (fullAppointment as any).consultationFee || doctor.consultationFee || 0;

    console.log(`[Receipt] Generating PDF for ${patientName} (${patientUser.email}), order ${orderId}, amount ${amount}`);
    const receiptPdfBuffer = await generatePaymentReceiptPdf({
      patientName,
      patientRut: patient?.rut || patientUser?.rut || undefined,
      doctorName,
      doctorSpecialty: doctor.specialty,
      consultationDate: fullAppointment.scheduledDate,
      consultationTime: fullAppointment.scheduledTime?.slice(0, 5) || '',
      amount,
      commerceOrderId: orderId,
    });
    console.log(`[Receipt] PDF generated (${receiptPdfBuffer.length} bytes), sending email...`);

    await sendPaymentReceiptEmail({
      patientName,
      patientRut: patient?.rut || patientUser?.rut || undefined,
      patientEmail: patientUser.email,
      doctorName,
      doctorSpecialty: doctor.specialty,
      consultationDate: fullAppointment.scheduledDate,
      consultationTime: fullAppointment.scheduledTime?.slice(0, 5) || '',
      amount,
      commerceOrderId: orderId,
      receiptPdfBuffer,
    });
    console.log(`[Receipt] Payment receipt email with PDF sent for appointment ${appointmentId} to ${patientUser.email}`);
  }

  app.post("/api/flow/confirm", async (req, res) => {
    try {
      const { token, s: signature } = req.body;
      
      if (!token) {
        console.error("Flow webhook: Missing token in request body");
        return res.status(400).json({ error: "Token is required" });
      }
      
      // Security: Verify Flow signature if provided
      if (signature) {
        const isValidSignature = await verifyFlowSignature(req.body, signature);
        if (!isValidSignature) {
          console.error("Flow webhook: Invalid signature");
          return res.status(403).json({ error: "Invalid signature" });
        }
      }
      
      // Verify the token matches an appointment in our database first
      const appointment = await storage.getAppointmentByFlowToken(token);
      if (!appointment) {
        console.error("Flow webhook: No appointment found for token");
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      // Idempotency: if already paid, return success without re-processing
      if (appointment.paymentStatus === "paid") {
        console.log(`Flow webhook: Appointment ${appointment.id} already paid, skipping`);
        return res.json({ message: "Payment already processed", status: "paid" });
      }
      
      // Fetch current status from Flow API to ensure data integrity
      let paymentStatus;
      try {
        paymentStatus = await getPaymentStatus(token);
      } catch (apiError) {
        console.error("Flow webhook: Failed to fetch status from Flow API", apiError);
        return res.status(500).json({ error: "Failed to verify payment with Flow" });
      }
      
      const optional = JSON.parse(paymentStatus.optional || '{}');
      const appointmentId = optional.appointmentId || appointment.id;
      
      // Double-check appointmentId matches
      if (appointmentId !== appointment.id) {
        console.error("Flow webhook: AppointmentId mismatch", { expected: appointment.id, received: appointmentId });
        return res.status(400).json({ error: "Payment data mismatch" });
      }
      
      const newStatus = getPaymentStatusText(paymentStatus.status);
      
      await storage.updateAppointment(appointmentId, {
        paymentStatus: newStatus,
        status: isPaymentSuccessful(paymentStatus.status) ? "confirmed" : "scheduled",
      });
      
      if (isPaymentSuccessful(paymentStatus.status) && appointment.paymentStatus !== "paid") {
        sendReceiptEmailForAppointment(appointmentId, paymentStatus.amount).catch(err => {
          console.error(`[Receipt] Background send failed for appointment ${appointmentId}:`, err?.message || err);
        });
      }
      
      console.log(`Flow payment confirmed for appointment ${appointmentId}: ${newStatus}`);
      res.json({ message: "Payment status updated", status: newStatus });
    } catch (error) {
      console.error("Error confirming Flow payment:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  app.get("/api/flow/status/:commerceOrderId", isAuthenticated, async (req: any, res) => {
    try {
      const { commerceOrderId } = req.params;
      const userId = req.userId;
      
      const appointment = await storage.getAppointmentByCommerceOrderId(commerceOrderId);
      if (!appointment) {
        return res.status(404).json({ error: "Pago no encontrado" });
      }
      
      // Verify user owns this appointment
      const patient = await storage.getPatientByUserId(userId);
      if (!patient || appointment.patientId !== patient.id) {
        return res.status(403).json({ error: "No tienes permiso para ver este pago" });
      }
      
      if (!appointment.flowToken) {
        return res.status(400).json({ error: "No hay token de pago" });
      }
      
      const paymentStatus = await getPaymentStatus(appointment.flowToken);
      const status = getPaymentStatusText(paymentStatus.status);
      const wasNotPaid = appointment.paymentStatus !== "paid";

      await storage.updateAppointment(appointment.id, {
        paymentStatus: status,
        status: isPaymentSuccessful(paymentStatus.status) ? "confirmed" : appointment.status,
      });

      if (isPaymentSuccessful(paymentStatus.status) && wasNotPaid) {
        sendReceiptEmailForAppointment(appointment.id, paymentStatus.amount).catch(err => {
          console.error(`[Receipt] Background send failed for appointment ${appointment.id}:`, err?.message || err);
        });
      }

      res.json({
        status,
        isSuccessful: isPaymentSuccessful(paymentStatus.status),
        amount: paymentStatus.amount,
        currency: paymentStatus.currency,
      });
    } catch (error) {
      console.error("Error checking Flow payment status:", error);
      res.status(500).json({ error: "Error al verificar el estado del pago" });
    }
  });

  app.get("/api/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const appointments = await storage.getAppointmentsByPatient(patient.id);
      const payments = appointments
        .filter(a => a.flowToken || a.paymentStatus === "paid")
        .map(a => ({
          id: a.flowCommerceOrderId || `appt-${a.id}`,
          amount: a.consultationFee || 5000,
          currency: "CLP",
          status: a.paymentStatus === "paid" ? "succeeded" : a.paymentStatus,
          createdAt: a.scheduledDate,
          appointmentId: a.id,
          doctorName: a.doctorName,
          doctorSpecialty: a.doctorSpecialty,
        }));
      
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Reschedule appointment
  app.post("/api/appointments/:id/reschedule", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;
      const { scheduledDate, scheduledTime } = req.body;

      if (!scheduledDate || !scheduledTime) {
        return res.status(400).json({ error: "Fecha y hora son requeridas" });
      }

      const patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.patientId !== patient.id) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }

      if (!["scheduled", "confirmed"].includes(appointment.status)) {
        return res.status(400).json({ error: "Solo se pueden reagendar citas programadas o confirmadas" });
      }

      const hasConflict = await storage.hasConflictingAppointment(
        appointment.doctorId,
        scheduledDate,
        scheduledTime
      );
      if (hasConflict) {
        return res.status(409).json({ error: "El horario seleccionado no está disponible" });
      }

      const updated = await storage.updateAppointment(appointmentId, {
        scheduledDate,
        scheduledTime,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      res.status(500).json({ error: "Error al reagendar la cita" });
    }
  });

  app.get("/api/appointments/:id/receipt", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Cita no encontrada" });

      const patient = await storage.getPatient(appointment.patientId);
      if (!patient) return res.status(404).json({ error: "Paciente no encontrado" });

      const patientUser = await storage.getUser(patient.userId);
      if (!patientUser || patientUser.id !== userId) {
        const doctor = await storage.getDoctorByUserId(userId);
        if (!doctor || doctor.id !== appointment.doctorId) {
          return res.status(403).json({ error: "No autorizado" });
        }
      }

      if (appointment.paymentStatus !== 'paid' && appointment.paymentStatus !== 'completed') {
        return res.status(400).json({ error: "Esta cita no tiene un pago completado" });
      }

      const doctor = await storage.getDoctor(appointment.doctorId);
      const doctorUser = doctor ? await storage.getUser(doctor.userId) : null;
      if (!doctor || !doctorUser) return res.status(404).json({ error: "Doctor no encontrado" });

      const patientName = `${patientUser?.firstName || ''} ${patientUser?.lastName || ''}`.trim() || 'Paciente';
      const doctorName = `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim();
      const orderId = appointment.flowCommerceOrderId || `APT-${appointmentId}`;

      const pdfBuffer = await generatePaymentReceiptPdf({
        patientName,
        patientRut: patient.rut || patientUser?.rut || undefined,
        doctorName,
        doctorSpecialty: doctor.specialty,
        consultationDate: appointment.scheduledDate,
        consultationTime: appointment.scheduledTime?.slice(0, 5) || '',
        amount: doctor.consultationFee,
        commerceOrderId: orderId,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Boleta_${orderId}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating receipt PDF:", error);
      res.status(500).json({ error: "Error al generar la boleta" });
    }
  });

  // Reimbursement request endpoints
  app.post("/api/appointments/:id/reimbursement", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;
      const { reason } = req.body;

      if (!reason || reason.trim().length < 10) {
        return res.status(400).json({ error: "El motivo debe tener al menos 10 caracteres" });
      }

      const patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.patientId !== patient.id) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }

      if (appointment.paymentStatus !== "paid") {
        return res.status(400).json({ error: "Solo se puede solicitar reembolso para citas pagadas" });
      }

      const existing = await storage.getReimbursementRequestByAppointment(appointmentId);
      if (existing) {
        return res.status(409).json({ error: "Ya existe una solicitud de reembolso para esta cita" });
      }

      const doctor = await storage.getDoctor(appointment.doctorId);
      const amount = doctor?.consultationFee || 25000;

      const request = await storage.createReimbursementRequest({
        appointmentId,
        patientId: patient.id,
        reason: reason.trim(),
        status: "pending",
        amount,
      });

      res.json(request);
    } catch (error) {
      console.error("Error creating reimbursement request:", error);
      res.status(500).json({ error: "Error al crear solicitud de reembolso" });
    }
  });

  app.get("/api/reimbursements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        return res.json([]);
      }
      const requests = await storage.getReimbursementRequestsByPatient(patient.id);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching reimbursements:", error);
      res.status(500).json({ error: "Error al obtener reembolsos" });
    }
  });

  app.get("/api/appointments/:id/reimbursement", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.patientId !== patient.id) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const existing = await storage.getReimbursementRequestByAppointment(appointmentId);
      res.json(existing || null);
    } catch (error) {
      console.error("Error fetching reimbursement:", error);
      res.status(500).json({ error: "Error al obtener reembolso" });
    }
  });

  // Online presence check for consultations
  app.get("/api/appointments/:id/presence", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Cita no encontrada" });
      }

      const patient = await storage.getPatientByUserId(userId);
      const doctor = await storage.getDoctorByUserId(userId);
      const isPatientOwner = patient && appointment.patientId === patient.id;
      const isDoctorOwner = doctor && appointment.doctorId === doctor.id;

      if (!isPatientOwner && !isDoctorOwner) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const roomId = `consultation-${appointmentId}`;
      const room = signalingRooms.get(roomId);

      const result = {
        doctorOnline: false,
        patientOnline: false,
        patientWaiting: false,
      };

      if (room) {
        if (isDoctorOwner) {
          result.patientWaiting = room.waitingPatients.size > 0;
          result.patientOnline = room.participants.size > 1 || room.waitingPatients.size > 0;
        }
        if (isPatientOwner) {
          result.doctorOnline = !!(room.doctorUserId && room.participants.has(room.doctorUserId));
        }
      }

      res.json(result);
    } catch (error) {
      console.error("Error checking presence:", error);
      res.status(500).json({ error: "Error al verificar presencia" });
    }
  });

  // GES (Garantías Explícitas en Salud) search routes
  app.get("/api/ges/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (query.length < 2) {
        return res.json([]);
      }
      const results = await storage.searchGes(query, 20);
      res.json(results);
    } catch (error) {
      console.error("Error searching GES:", error);
      res.status(500).json({ error: "Error al buscar en base GES" });
    }
  });

  app.get("/api/ges/problems", isAuthenticated, async (req: any, res) => {
    try {
      const query = (req.query.q as string || "").trim();
      if (query.length < 2) {
        return res.json([]);
      }
      const results = await storage.searchGesProblems(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching GES problems:", error);
      res.status(500).json({ error: "Error al buscar problemas GES" });
    }
  });

  app.get("/api/ges/problems/:id/descriptors", isAuthenticated, async (req: any, res) => {
    try {
      const idProblema = parseInt(req.params.id);
      const results = await storage.getGesDescriptorsByProblem(idProblema);
      res.json(results);
    } catch (error) {
      console.error("Error fetching GES descriptors:", error);
      res.status(500).json({ error: "Error al obtener descriptores GES" });
    }
  });

  app.post("/api/ges/match", isAuthenticated, async (req: any, res) => {
    try {
      const { diagnosis } = req.body;
      if (!diagnosis || typeof diagnosis !== "string" || diagnosis.trim().length < 3) {
        return res.json([]);
      }
      const results = await storage.matchGesFromDiagnosis(diagnosis.trim());
      res.json(results);
    } catch (error) {
      console.error("Error matching GES diagnosis:", error);
      res.status(500).json({ error: "Error al buscar diagnóstico GES" });
    }
  });

  // Clinical Records routes
  app.get("/api/clinical-records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const records = await storage.getClinicalRecordsByPatient(patient.id);
      res.json(records);
    } catch (error) {
      console.error("Error fetching clinical records:", error);
      res.status(500).json({ error: "Failed to fetch clinical records" });
    }
  });

  app.get("/api/clinical-records/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const records = await storage.getRecentRecordsByPatient(patient.id, 5);
      res.json(records);
    } catch (error) {
      console.error("Error fetching recent records:", error);
      res.status(500).json({ error: "Failed to fetch recent records" });
    }
  });

  app.get("/api/clinical-records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const recordId = parseInt(req.params.id);
      const record = await storage.getClinicalRecord(recordId);
      if (!record) {
        return res.status(404).json({ error: "Record not found" });
      }
      
      // Get associated prescription if exists
      const prescription = await storage.getPrescriptionByRecordId(recordId);
      
      res.json({
        ...record,
        prescription: prescription || null
      });
    } catch (error) {
      console.error("Error fetching clinical record:", error);
      res.status(500).json({ error: "Failed to fetch clinical record" });
    }
  });

  app.post("/api/clinical-records", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body against clinicalRecordSchema
      const validationResult = insertClinicalRecordSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const recordData = validationResult.data;
      const record = await storage.createClinicalRecord(recordData);
      res.json(record);
    } catch (error) {
      console.error("Error creating clinical record:", error);
      res.status(500).json({ error: "Failed to create clinical record" });
    }
  });

  // Prescriptions routes
  app.get("/api/prescriptions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const prescriptions = await storage.getPrescriptionsByPatient(patient.id);
      res.json(prescriptions);
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
      res.status(500).json({ error: "Failed to fetch prescriptions" });
    }
  });

  app.get("/api/prescriptions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const prescription = await storage.getPrescription(parseInt(req.params.id));
      if (!prescription) {
        return res.status(404).json({ error: "Prescription not found" });
      }
      res.json(prescription);
    } catch (error) {
      console.error("Error fetching prescription:", error);
      res.status(500).json({ error: "Failed to fetch prescription" });
    }
  });

  app.get("/api/medical-instructions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const instructions = await storage.getInstructionsWithDoctorByPatient(patient.id);
      res.json(instructions);
    } catch (error) {
      console.error("Error fetching medical instructions:", error);
      res.status(500).json({ error: "Failed to fetch medical instructions" });
    }
  });

  app.get("/api/exam-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      const orders = await storage.getExamOrdersWithDoctorByPatient(patient.id);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching exam orders:", error);
      res.status(500).json({ error: "Failed to fetch exam orders" });
    }
  });

  app.post("/api/prescriptions", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body against prescriptionSchema
      const validationResult = insertPrescriptionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const prescriptionData = validationResult.data;
      const prescription = await storage.createPrescription(prescriptionData);
      res.json(prescription);
    } catch (error) {
      console.error("Error creating prescription:", error);
      res.status(500).json({ error: "Failed to create prescription" });
    }
  });

  // Consultation routes
  app.get("/api/consultations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consultation not found" });
      }

      const doctor = await storage.getDoctor(appointment.doctorId);
      const doctorUser = doctor ? await storage.getUser(doctor.userId) : null;
      const appointmentPatient = await storage.getPatient(appointment.patientId);
      const patientUser = appointmentPatient ? await storage.getUser(appointmentPatient.userId) : null;

      const isDoctor = doctor?.userId === userId;
      const isPatient = appointmentPatient?.userId === userId;

      if (!isDoctor && !isPatient) {
        return res.status(403).json({ error: "Not authorized to access this consultation" });
      }

      // Get clinical record if exists
      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);

      res.json({
        appointment: {
          id: appointment.id,
          scheduledDate: appointment.scheduledDate,
          scheduledTime: appointment.scheduledTime,
          status: appointment.status,
          consultationType: appointment.consultationType,
          notes: appointment.notes,
        },
        doctor: {
          id: doctor?.id,
          specialty: doctor?.specialty,
          userName: appointment.doctorName || (doctorUser ? `${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() : ''),
          userImage: appointment.doctorImage || doctorUser?.profileImageUrl,
          userId: doctor?.userId || '',
        },
        patient: {
          id: appointmentPatient?.id,
          dateOfBirth: appointmentPatient?.dateOfBirth,
          gender: appointmentPatient?.gender,
          bloodType: appointmentPatient?.bloodType,
          allergies: appointmentPatient?.allergies,
          medicalHistory: appointmentPatient?.medicalHistory,
          userName: patientUser?.firstName ? `${patientUser.firstName} ${patientUser.lastName}` : patientUser?.email,
          userImage: patientUser?.profileImageUrl,
        },
        clinicalRecord,
      });
    } catch (error) {
      console.error("Error fetching consultation:", error);
      res.status(500).json({ error: "Failed to fetch consultation" });
    }
  });

  app.get("/api/consultations/:id/summary", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consulta no encontrada" });
      }

      const doctor = await storage.getDoctor(appointment.doctorId);
      const doctorUser = doctor ? await storage.getUser(doctor.userId) : null;
      const patient = await storage.getPatient(appointment.patientId);
      const patientUser = patient ? await storage.getUser(patient.userId) : null;

      const isDoctor = doctor?.userId === userId;
      const isPatient = patient?.userId === userId;

      if (!isDoctor && !isPatient) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      let prescription = null;
      let medicalInstructions: any[] = [];
      let examOrders = null;

      if (clinicalRecord) {
        prescription = await storage.getPrescriptionByRecordId(clinicalRecord.id);
        medicalInstructions = await storage.getInstructionsByRecordId(clinicalRecord.id);
        const examOrdersList = await storage.getExamOrdersByRecordId(clinicalRecord.id);
        examOrders = examOrdersList[0] || null;
      }

      res.json({
        appointment: {
          id: appointment.id,
          scheduledDate: appointment.scheduledDate,
          scheduledTime: appointment.scheduledTime,
          status: appointment.status,
          consultationType: appointment.consultationType,
          notes: appointment.notes,
        },
        doctor: {
          name: doctorUser ? `${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() : '',
          specialty: doctor?.specialty || '',
        },
        patient: {
          name: patientUser ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() : '',
          gender: patient?.gender,
          bloodType: patient?.bloodType,
          allergies: patient?.allergies,
        },
        clinicalRecord: clinicalRecord ? {
          chiefComplaint: clinicalRecord.chiefComplaint,
          symptoms: clinicalRecord.symptoms,
          diagnosis: clinicalRecord.diagnosis,
          notes: clinicalRecord.notes,
        } : null,
        prescription,
        medicalInstructions,
        examOrders,
      });
    } catch (error) {
      console.error("Error fetching consultation summary:", error);
      res.status(500).json({ error: "Error al obtener resumen de consulta" });
    }
  });

  app.post("/api/consultations/:id/end", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const { audioData, notes, diagnosis, symptoms } = req.body;
      
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consultation not found" });
      }
      
      await storage.updateAppointment(appointmentId, { status: "pending_validation" });
      
      let transcription = "";

      if (audioData) {
        try {
          const audioBuffer = Buffer.from(audioData, 'base64');
          console.log(`[Transcription] Starting post-call transcription for appointment ${appointmentId}. Audio base64 length: ${audioData.length}, decoded size: ${audioBuffer.length} bytes (${(audioBuffer.length / 1024).toFixed(1)} KB)`);
          if (audioBuffer.length < 1000) {
            console.warn(`[Transcription] WARNING: Audio data is very small (${audioBuffer.length} bytes) for appointment ${appointmentId} - transcription quality may be poor`);
          }
          transcription = await transcribeAudioChunked(audioData);
          console.log(`[Transcription] Completed for appointment ${appointmentId}. Transcription length: ${transcription.length} chars`);
          if (transcription.length === 0) {
            console.warn(`[Transcription] WARNING: Transcription returned empty for appointment ${appointmentId} despite having ${audioBuffer.length} bytes of audio`);
          }
        } catch (e: any) {
          console.error(`[Transcription] Error transcribing audio for appointment ${appointmentId}:`, e?.message || e);
        }
      } else {
        console.warn(`[Transcription] No audio data received for appointment ${appointmentId}. Request body keys: ${Object.keys(req.body).join(', ')}`);
      }
      
      const record = await storage.createClinicalRecord({
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentId,
        chiefComplaint: appointment.notes,
        symptoms: symptoms || [],
        diagnosis,
        notes,
        transcription: transcription || null,
      });
      
      let aiSuggestions = null;
      if (transcription) {
        try {
          console.log(`[AI] Generating suggestions from transcription for appointment ${appointmentId}...`);
          aiSuggestions = await generateFullConsultationSuggestions(transcription);
          console.log(`[AI] Suggestions generated successfully`);
          
          if (aiSuggestions) {
            const updateData: any = {};
            if (aiSuggestions.clinicalSummary) {
              if (aiSuggestions.clinicalSummary.chiefComplaint) updateData.chiefComplaint = aiSuggestions.clinicalSummary.chiefComplaint;
              if (aiSuggestions.clinicalSummary.symptoms) updateData.symptoms = aiSuggestions.clinicalSummary.symptoms;
              if (aiSuggestions.clinicalSummary.diagnosis) updateData.diagnosis = aiSuggestions.clinicalSummary.diagnosis;
              if (aiSuggestions.clinicalSummary.notes) updateData.notes = aiSuggestions.clinicalSummary.notes;
            }
            if (aiSuggestions.clinicalSummary?.diagnosis) {
              try {
                const gesMatches = await storage.matchGesFromDiagnosis(aiSuggestions.clinicalSummary.diagnosis);
                if (gesMatches.length > 0) {
                  updateData.gesDiagnosis = gesMatches;
                  console.log(`[AI] Auto-matched ${gesMatches.length} GES diagnosis(es) for: ${aiSuggestions.clinicalSummary.diagnosis}`);
                }
              } catch (e) {
                console.error("[AI] Error matching GES diagnosis:", e);
              }
            }
            if (Object.keys(updateData).length > 0) {
              await storage.updateClinicalRecord(record.id, updateData);
            }

            if (aiSuggestions.prescription && aiSuggestions.prescription.medications?.length > 0) {
              try {
                await storage.createPrescription({
                  clinicalRecordId: record.id,
                  patientId: appointment.patientId,
                  doctorId: appointment.doctorId,
                  medications: aiSuggestions.prescription.medications,
                  instructions: aiSuggestions.prescription.instructions || null,
                  validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                  status: "draft",
                });
              } catch (e) {
                console.error("[AI] Error creating draft prescription:", e);
              }
            }

            if (aiSuggestions.medicalInstructions && aiSuggestions.medicalInstructions.length > 0) {
              for (const instr of aiSuggestions.medicalInstructions) {
                try {
                  await storage.createMedicalInstruction({
                    clinicalRecordId: record.id,
                    patientId: appointment.patientId,
                    doctorId: appointment.doctorId,
                    category: instr.category || "follow-up",
                    title: instr.title,
                    description: instr.description,
                    priority: instr.priority || "normal",
                  });
                } catch (e) {
                  console.error("[AI] Error creating draft instruction:", e);
                }
              }
            }

            if (aiSuggestions.examOrders && aiSuggestions.examOrders.length > 0) {
              try {
                await storage.createExamOrder({
                  clinicalRecordId: record.id,
                  patientId: appointment.patientId,
                  doctorId: appointment.doctorId,
                  exams: aiSuggestions.examOrders,
                });
              } catch (e) {
                console.error("[AI] Error creating draft exam order:", e);
              }
            }
          }
        } catch (e) {
          console.error("Error generating AI suggestions:", e);
        }
      }
      
      if (transcription) {
        try {
          console.log(`[AI] Generating medical report for appointment ${appointmentId}...`);
          const doctorTemplates = await storage.getReportTemplatesByDoctor(appointment.doctorId);
          const defaultTemplate = doctorTemplates.find(t => t.isDefault);
          
          if (defaultTemplate) {
            const reportText = await generateMedicalReportWithTemplate(transcription, defaultTemplate.prompt);
            if (reportText) {
              await storage.updateClinicalRecord(record.id, { medicalReport: { editedText: reportText, templateId: defaultTemplate.id, templateName: defaultTemplate.name } as any });
              console.log(`[AI] Medical report generated with template "${defaultTemplate.name}" and saved`);
            }
          } else {
            const medicalReport = await generateMedicalReport(transcription);
            if (medicalReport) {
              await storage.updateClinicalRecord(record.id, { medicalReport });
              console.log(`[AI] Medical report generated with default format and saved`);
            }
          }
        } catch (e) {
          console.error("[AI] Error generating medical report:", e);
        }
      }

      res.json({ success: true, recordId: record.id, appointmentId, aiSuggestions });
    } catch (error) {
      console.error("Error ending consultation:", error);
      res.status(500).json({ error: "Failed to end consultation" });
    }
  });

  app.post("/api/consultations/:id/regenerate-report", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;
      const { templateId } = req.body;
      if (templateId != null && (typeof templateId !== "number" || isNaN(templateId) || templateId <= 0)) {
        return res.status(400).json({ error: "Invalid template ID" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor || doctor.id !== appointment.doctorId) {
        return res.status(403).json({ error: "Not authorized" });
      }

      const record = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!record || !record.transcription) {
        return res.status(400).json({ error: "No transcription available for regeneration" });
      }

      let reportText: string | null = null;
      let templateName: string | null = null;

      if (templateId) {
        const template = await storage.getReportTemplate(templateId);
        if (!template || template.doctorId !== doctor.id) {
          return res.status(404).json({ error: "Template not found" });
        }
        reportText = await generateMedicalReportWithTemplate(record.transcription, template.prompt);
        templateName = template.name;
      } else {
        reportText = await generateMedicalReportWithTemplate(record.transcription, DEFAULT_REPORT_TEMPLATE_PROMPT);
      }

      if (reportText) {
        const medicalReport = templateId
          ? { editedText: reportText, templateId, templateName }
          : { editedText: reportText };
        await storage.updateClinicalRecord(record.id, { medicalReport: medicalReport as any });
        res.json({ success: true, reportText });
      } else {
        res.status(500).json({ error: "Failed to generate report" });
      }
    } catch (error) {
      console.error("Error regenerating report:", error);
      res.status(500).json({ error: "Failed to regenerate report" });
    }
  });

  app.get("/api/consultations/:id/validation", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consulta no encontrada" });
      }

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor || doctor.id !== appointment.doctorId) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!clinicalRecord) {
        return res.status(404).json({ error: "Registro clínico no encontrado" });
      }

      const existingPrescription = await storage.getPrescriptionByRecordId(clinicalRecord.id);
      const existingInstructions = await storage.getInstructionsByRecordId(clinicalRecord.id);
      const existingExamOrders = await storage.getExamOrdersByRecordId(clinicalRecord.id);

      const patient = await storage.getPatient(appointment.patientId);
      const patientUser = patient ? await storage.getUser(patient.userId) : null;

      res.json({
        appointment: {
          id: appointment.id,
          scheduledDate: appointment.scheduledDate,
          scheduledTime: appointment.scheduledTime,
          status: appointment.status,
          consultationType: appointment.consultationType,
          notes: appointment.notes,
        },
        patient: {
          id: patient?.id,
          name: patientUser ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || patientUser.email : 'Paciente',
          rut: patient?.rut || patientUser?.rut || undefined,
          email: patient?.email || patientUser?.email || undefined,
          whatsapp: patient?.whatsapp || undefined,
          dateOfBirth: patient?.dateOfBirth,
          gender: patient?.gender,
          bloodType: patient?.bloodType,
          allergies: patient?.allergies,
          isPregnant: patient?.isPregnant ?? false,
          isBreastfeeding: patient?.isBreastfeeding ?? false,
          medicalHistory: patient?.medicalHistory || undefined,
          emergencyContact: patient?.emergencyContact || undefined,
          emergencyPhone: patient?.emergencyPhone || undefined,
        },
        clinicalRecord: {
          id: clinicalRecord.id,
          chiefComplaint: clinicalRecord.chiefComplaint,
          symptoms: clinicalRecord.symptoms,
          diagnosis: clinicalRecord.diagnosis,
          notes: clinicalRecord.notes,
          gesDiagnosis: clinicalRecord.gesDiagnosis || null,
          medicalReport: clinicalRecord.medicalReport || null,
          hasTranscription: !!clinicalRecord.transcription,
        },
        prescription: existingPrescription || null,
        medicalInstructions: existingInstructions || [],
        examOrders: existingExamOrders[0] || null,
      });
    } catch (error) {
      console.error("Error fetching validation data:", error);
      res.status(500).json({ error: "Error al obtener datos de validación" });
    }
  });

  app.post("/api/consultations/:id/validate", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;
      const { 
        clinicalRecord: clinicalData, 
        prescription: prescriptionData, 
        medicalInstructions: instructionsData,
        examOrders: examOrdersData 
      } = req.body;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consulta no encontrada" });
      }

      if (appointment.status !== "pending_validation") {
        return res.status(400).json({ error: "Esta consulta no está pendiente de validación" });
      }

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor || doctor.id !== appointment.doctorId) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const existingRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!existingRecord) {
        return res.status(404).json({ error: "Registro clínico no encontrado" });
      }

      const gesDiagnosisSchema = z.object({
        idProblema: z.number(),
        problemaDeSalud: z.string(),
        codigoCie10: z.string(),
        descriptor: z.string(),
      });

      const clinicalSchema = z.object({
        chiefComplaint: z.string().optional().nullable(),
        symptoms: z.array(z.string()).optional(),
        diagnosis: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        gesDiagnosis: z.array(gesDiagnosisSchema).optional().nullable(),
        medicalReportText: z.string().optional().nullable(),
      });

      const medicationSchema = z.object({
        name: z.string().min(1, "Nombre del medicamento requerido"),
        dosage: z.string().nullable().optional().transform(v => v || ""),
        frequency: z.string().nullable().optional().transform(v => v || ""),
        duration: z.string().nullable().optional().transform(v => v || ""),
        instructions: z.string().nullable().optional(),
      });

      const prescriptionSchema = z.object({
        medications: z.array(medicationSchema).min(1),
        instructions: z.string().optional().nullable(),
      }).nullable().optional();

      const instructionSchema = z.object({
        category: z.enum(["diet", "exercise", "lifestyle", "follow-up", "tests"]),
        title: z.string().min(1, "Título requerido"),
        description: z.string().min(1, "Descripción requerida"),
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
        dueDate: z.string().optional().nullable(),
      });

      if (clinicalData) {
        const parsed = clinicalSchema.safeParse(clinicalData);
        if (!parsed.success) {
          return res.status(400).json({ error: "Datos clínicos inválidos", errors: parsed.error.flatten() });
        }
        const updateData: any = {
          chiefComplaint: parsed.data.chiefComplaint || null,
          symptoms: parsed.data.symptoms || [],
          diagnosis: parsed.data.diagnosis || null,
          notes: parsed.data.notes || null,
          gesDiagnosis: parsed.data.gesDiagnosis || null,
        };
        if (parsed.data.medicalReportText !== undefined) {
          const existingReport = existingRecord.medicalReport || {} as any;
          updateData.medicalReport = { ...existingReport, editedText: parsed.data.medicalReportText };
        }
        await storage.updateClinicalRecord(existingRecord.id, updateData);
      }

      if (prescriptionData && prescriptionData.medications?.length > 0) {
        const parsed = prescriptionSchema.safeParse(prescriptionData);
        if (!parsed.success) {
          return res.status(400).json({ error: "Datos de receta inválidos", errors: parsed.error.flatten() });
        }
        const existingPrescription = await storage.getPrescriptionByRecordId(existingRecord.id);
        if (existingPrescription) {
          await storage.updatePrescription(existingPrescription.id, {
            medications: parsed.data!.medications,
            instructions: parsed.data!.instructions || null,
          });
        } else {
          await storage.createPrescription({
            clinicalRecordId: existingRecord.id,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            medications: parsed.data!.medications,
            instructions: parsed.data!.instructions || null,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: "active",
          });
        }
      }

      await storage.deleteInstructionsByRecordId(existingRecord.id);
      if (instructionsData && instructionsData.length > 0) {
        const parsedInstructions = z.array(instructionSchema).safeParse(instructionsData);
        if (!parsedInstructions.success) {
          return res.status(400).json({ error: "Indicaciones médicas inválidas", errors: parsedInstructions.error.flatten() });
        }
        for (const instruction of parsedInstructions.data) {
          await storage.createMedicalInstruction({
            clinicalRecordId: existingRecord.id,
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            category: instruction.category,
            title: instruction.title,
            description: instruction.description,
            priority: instruction.priority,
            dueDate: instruction.dueDate || null,
          });
        }
      }

      await storage.deleteExamOrdersByRecordId(existingRecord.id);
      if (examOrdersData && examOrdersData.exams?.length > 0) {
        const examOrderSchema = z.object({
          exams: z.array(z.object({
            name: z.string().min(1, "Nombre del examen requerido"),
            justification: z.string().nullable().optional(),
          })).min(1),
        });

        const parsedExams = examOrderSchema.safeParse(examOrdersData);
        if (!parsedExams.success) {
          return res.status(400).json({ error: "Órdenes de exámenes inválidas", errors: parsedExams.error.flatten() });
        }

        await storage.createExamOrder({
          clinicalRecordId: existingRecord.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          exams: parsedExams.data.exams,
          clinicalJustification: null,
          status: "pending",
        });
      }

      await storage.updateAppointment(appointmentId, { status: "completed" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error validating consultation:", error);
      res.status(500).json({ error: "Error al validar la consulta" });
    }
  });

  app.post("/api/consultations/:id/send-documents", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;
      const { documentTypes } = req.body;

      const validTypes = ['prescription', 'instructions', 'exams'];
      const requestedTypes: ('prescription' | 'instructions' | 'exams')[] = 
        Array.isArray(documentTypes) ? documentTypes.filter((t: string) => validTypes.includes(t)) : validTypes;

      if (requestedTypes.length === 0) {
        return res.status(400).json({ error: "No se especificaron tipos de documentos válidos" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consulta no encontrada" });
      }

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor || doctor.id !== appointment.doctorId) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const patient = await storage.getPatient(appointment.patientId);
      if (!patient) {
        return res.status(404).json({ error: "Paciente no encontrado" });
      }

      const patientUser = await storage.getUser(patient.userId);
      if (!patientUser || !patientUser.email) {
        return res.status(400).json({ error: "El paciente no tiene un correo electrónico registrado" });
      }

      const doctorUser = await storage.getUser(doctor.userId);
      const doctorName = doctorUser ? `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() : 'Doctor';

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!clinicalRecord) {
        return res.status(404).json({ error: "Registro clínico no encontrado" });
      }

      let prescription = null;
      let medicalInstructionsList: any[] = [];
      let examOrdersData = null;

      if (requestedTypes.includes('prescription')) {
        const existingPrescription = await storage.getPrescriptionByRecordId(clinicalRecord.id);
        if (existingPrescription) {
          prescription = {
            medications: existingPrescription.medications,
            instructions: existingPrescription.instructions,
          };
        }
      }

      if (requestedTypes.includes('instructions')) {
        const existingInstructions = await storage.getInstructionsByRecordId(clinicalRecord.id);
        if (existingInstructions?.length > 0) {
          medicalInstructionsList = existingInstructions.map((i: any) => ({
            category: i.category,
            title: i.title,
            description: i.description,
            priority: i.priority,
          }));
        }
      }

      if (requestedTypes.includes('exams')) {
        const existingExamOrders = await storage.getExamOrdersByRecordId(clinicalRecord.id);
        if (existingExamOrders?.length > 0) {
          examOrdersData = {
            exams: existingExamOrders[0].exams,
          };
        }
      }

      const hasPrescription = prescription && prescription.medications?.length > 0;
      const hasInstructions = medicalInstructionsList.length > 0;
      const hasExams = examOrdersData && examOrdersData.exams?.length > 0;

      if (!hasPrescription && !hasInstructions && !hasExams) {
        return res.status(400).json({ error: "No hay documentos disponibles para enviar" });
      }

      const consultationDate = appointment.scheduledDate
        ? new Date(appointment.scheduledDate).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Fecha no disponible';

      const patientName = `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Paciente';

      const pdfData: PdfDocumentData = {
        doctorName,
        doctorSpecialty: doctor.specialty || 'Medicina General',
        doctorLicense: doctor.licenseNumber || undefined,
        patientName,
        patientRut: patientUser.rut || undefined,
        consultationDate,
        diagnosis: clinicalRecord.diagnosis || undefined,
        prescription: hasPrescription ? prescription : null,
        medicalInstructions: hasInstructions ? medicalInstructionsList : undefined,
        examOrders: hasExams ? examOrdersData : null,
        documentTypes: requestedTypes,
      };

      const pdfBuffers = await generateSeparateConsultationPdfs(pdfData);

      // Refetch full DB rows to access signing fields reliably
      const fullPrescription = requestedTypes.includes('prescription')
        ? await storage.getPrescriptionByRecordId(clinicalRecord.id)
        : undefined;
      const fullInstructions = requestedTypes.includes('instructions')
        ? await storage.getInstructionsByRecordId(clinicalRecord.id)
        : [];
      const fullExamOrders = requestedTypes.includes('exams')
        ? await storage.getExamOrdersByRecordId(clinicalRecord.id)
        : [];

      // Swap in signed PDFs when available
      for (const entry of pdfBuffers) {
        let signedB64: string | null = null;
        if (entry.type === 'prescription') signedB64 = (fullPrescription as any)?.signedPdfData || null;
        else if (entry.type === 'instructions') signedB64 = (fullInstructions[0] as any)?.signedPdfData || null;
        else if (entry.type === 'exams') signedB64 = (fullExamOrders[0] as any)?.signedPdfData || null;
        if (signedB64) {
          entry.buffer = Buffer.from(signedB64, 'base64');
          entry.filename = entry.filename.replace(/\.pdf$/, '_firmado.pdf');
        }
      }

      // Mark signed documents as sent
      if (fullPrescription && (fullPrescription as any).signedPdfData && requestedTypes.includes('prescription')) {
        await storage.updatePrescription((fullPrescription as any).id, { status: 'sent' } as any);
      }
      if (fullInstructions.length > 0 && (fullInstructions[0] as any).signedPdfData && requestedTypes.includes('instructions')) {
        for (const i of fullInstructions) {
          await storage.updateMedicalInstruction(i.id, { status: 'sent' } as any);
        }
      }
      if (fullExamOrders.length > 0 && (fullExamOrders[0] as any).signedPdfData && requestedTypes.includes('exams')) {
        for (const o of fullExamOrders) {
          await storage.updateExamOrder(o.id, { status: 'sent' } as any);
        }
      }

      await sendConsultationDocuments({
        patientName,
        patientEmail: patientUser.email,
        doctorName,
        doctorSpecialty: doctor.specialty || 'Medicina General',
        consultationDate,
        prescription: hasPrescription ? prescription : null,
        medicalInstructions: hasInstructions ? medicalInstructionsList : undefined,
        examOrders: hasExams ? examOrdersData : null,
        documentTypes: requestedTypes,
        pdfBuffers,
      });

      res.json({ 
        success: true, 
        message: "Documentos enviados exitosamente",
        sentTo: patientUser.email,
        documentsSent: {
          prescription: hasPrescription,
          instructions: hasInstructions,
          exams: hasExams,
        }
      });
    } catch (error: any) {
      console.error("Error sending consultation documents:", error);
      res.status(500).json({ error: error.message || "Error al enviar los documentos" });
    }
  });

  app.get("/api/consultations/:id/documents/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consulta no encontrada" });
      }

      const requesterDoctor = await storage.getDoctorByUserId(userId);
      const requesterPatient = await storage.getPatientByUserId(userId);

      const isDoctor = requesterDoctor && requesterDoctor.id === appointment.doctorId;
      const isPatient = requesterPatient && requesterPatient.id === appointment.patientId;

      if (!isDoctor && !isPatient) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const typesParam = typeof req.query.types === 'string' ? req.query.types : 'prescription,instructions,exams';
      const validTypes = ['prescription', 'instructions', 'exams'];
      const documentTypes = typesParam.split(',').filter((t: string) => validTypes.includes(t)) as ('prescription' | 'instructions' | 'exams')[];

      if (documentTypes.length === 0) {
        return res.status(400).json({ error: "No se especificaron tipos de documentos válidos" });
      }

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!clinicalRecord) {
        return res.status(404).json({ error: "Registro clínico no encontrado" });
      }

      const appointmentDoctor = await storage.getDoctor(appointment.doctorId);
      const doctorUser = appointmentDoctor ? await storage.getUser(appointmentDoctor.userId) : null;
      const doctorName = doctorUser ? `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() : 'Doctor';

      const appointmentPatient = await storage.getPatient(appointment.patientId);
      const patientUser = appointmentPatient ? await storage.getUser(appointmentPatient.userId) : null;
      const patientName = patientUser ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() : 'Paciente';

      let prescription = null;
      let medicalInstructionsList: any[] = [];
      let examOrdersData = null;

      if (documentTypes.includes('prescription')) {
        const existing = await storage.getPrescriptionByRecordId(clinicalRecord.id);
        if (existing) {
          prescription = { medications: existing.medications, instructions: existing.instructions };
        }
      }

      if (documentTypes.includes('instructions')) {
        const existing = await storage.getInstructionsByRecordId(clinicalRecord.id);
        if (existing?.length > 0) {
          medicalInstructionsList = existing.map((i: any) => ({
            category: i.category, title: i.title, description: i.description, priority: i.priority,
          }));
        }
      }

      if (documentTypes.includes('exams')) {
        const existing = await storage.getExamOrdersByRecordId(clinicalRecord.id);
        if (existing?.length > 0) {
          examOrdersData = { exams: existing[0].exams };
        }
      }

      const hasPrescription = prescription && prescription.medications?.length > 0;
      const hasInstructions = medicalInstructionsList.length > 0;
      const hasExams = examOrdersData && examOrdersData.exams?.length > 0;

      if (!hasPrescription && !hasInstructions && !hasExams) {
        return res.status(404).json({ error: "No hay documentos disponibles" });
      }

      const consultationDate = appointment.scheduledDate
        ? new Date(appointment.scheduledDate).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Fecha no disponible';

      const pdfData: PdfDocumentData = {
        doctorName,
        doctorSpecialty: appointmentDoctor?.specialty || 'Medicina General',
        doctorLicense: appointmentDoctor?.licenseNumber || undefined,
        patientName,
        patientRut: patientUser?.rut || undefined,
        consultationDate,
        diagnosis: clinicalRecord.diagnosis || undefined,
        prescription: hasPrescription ? prescription : null,
        medicalInstructions: hasInstructions ? medicalInstructionsList : undefined,
        examOrders: hasExams ? examOrdersData : null,
        documentTypes,
      };

      const pdfBuffer = await generateConsultationPdf(pdfData);

      const filename = `consulta_${appointmentId}_${new Date().toISOString().slice(0, 10)}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: error.message || "Error al generar el PDF" });
    }
  });

  app.post("/api/consultations/:id/generate-suggestions", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consulta no encontrada" });
      }

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor || doctor.id !== appointment.doctorId) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      if (!clinicalRecord || !clinicalRecord.transcription) {
        return res.status(400).json({ error: "No hay transcripción disponible para generar sugerencias" });
      }

      const suggestions = await generateFullConsultationSuggestions(clinicalRecord.transcription);
      res.json(suggestions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ error: "Error al generar sugerencias" });
    }
  });

  app.post("/api/consultations/:id/alerts", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = req.userId;

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.doctorId !== doctor.id) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);
      const patient = await storage.getPatient(appointment.patientId);

      const { medications, medicalInstructions, examOrders } = req.body;

      const alerts = await generateClinicalAlerts({
        diagnosis: clinicalRecord?.diagnosis || undefined,
        symptoms: clinicalRecord?.symptoms || undefined,
        notes: clinicalRecord?.notes || undefined,
        transcription: clinicalRecord?.transcription || undefined,
        medications: medications || [],
        medicalInstructions: medicalInstructions || [],
        examOrders: examOrders || [],
        patientAllergies: patient?.allergies || [],
        medicalReport: clinicalRecord?.medicalReport || undefined,
      });

      res.json({ alerts });
    } catch (error) {
      console.error("Error generating clinical alerts:", error);
      res.status(500).json({ error: "Error al generar alertas clínicas" });
    }
  });

  async function buildAssistantContext(appointmentId: number, doctorUserId: string): Promise<AssistantContext> {
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) throw new Error("Appointment not found");

    const doctor = await storage.getDoctor(appointment.doctorId);
    const doctorUser = doctor ? await storage.getUser(doctor.userId) : null;
    const patient = await storage.getPatient(appointment.patientId);
    const patientUser = patient ? await storage.getUser(patient.userId) : null;

    const patientName = patientUser ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || patientUser.email : 'Paciente';
    const doctorName = doctorUser ? `${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim() : 'Doctor';

    let patientAge: number | undefined;
    if (patient?.dateOfBirth) {
      const birth = new Date(patient.dateOfBirth);
      const today = new Date();
      patientAge = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) patientAge--;
    }

    const allAppointments = await storage.getAppointmentsByPatient(appointment.patientId);
    const completedPast = allAppointments.filter(a => a.id !== appointmentId && (a.status === 'completed' || a.status === 'pending_validation'));
    const previousConsultationsCount = completedPast.length;

    const clinicalRecord = await storage.getClinicalRecordByAppointmentId(appointmentId);

    const genderMap: Record<string, string> = { male: "Masculino", female: "Femenino", other: "Otro" };

    let previousConsultationsSummary: string | undefined;
    if (patient && previousConsultationsCount > 0) {
      try {
        const pastRecords = (await storage.getClinicalRecordsByPatient(appointment.patientId))
          .filter(r => r.appointmentId !== appointmentId);

        const latestRecordTs = pastRecords.reduce<number>((acc, r) => {
          const ts = new Date((r.updatedAt as any) || (r.createdAt as any) || 0).getTime();
          return ts > acc ? ts : acc;
        }, 0);

        const cachedAt = patient.historySummaryAt ? new Date(patient.historySummaryAt).getTime() : 0;
        const cacheStale = !patient.historySummary || cachedAt < latestRecordTs;

        if (!cacheStale && patient.historySummary) {
          previousConsultationsSummary = patient.historySummary;
        } else {
          const allPrescriptions = await storage.getPrescriptionsByPatient(appointment.patientId);
          const prescriptionsByRecord = new Map<number, Array<{ medication: string; dosage?: string; frequency?: string; duration?: string }>>();
          for (const p of allPrescriptions) {
            const meds = (p as any).medications;
            if (Array.isArray(meds)) {
              prescriptionsByRecord.set(p.clinicalRecordId, meds.map((m: any) => ({
                medication: m.medication || m.name || '',
                dosage: m.dosage,
                frequency: m.frequency,
                duration: m.duration,
              })));
            }
          }

          const pastConsultations: PastConsultationInput[] = pastRecords
            .sort((a, b) => new Date((b.updatedAt as any) || (b.createdAt as any) || 0).getTime() - new Date((a.updatedAt as any) || (a.createdAt as any) || 0).getTime())
            .slice(0, 15)
            .map(r => {
              const reportText = r.medicalReport && typeof r.medicalReport === 'object'
                ? ((r.medicalReport as any).editedText || (r.medicalReport as any).text || '')
                : '';
              const dateRaw = (r.updatedAt as any) || (r.createdAt as any);
              return {
                date: dateRaw ? new Date(dateRaw).toISOString().split('T')[0] : 'sin fecha',
                chiefComplaint: r.chiefComplaint || undefined,
                diagnosis: r.diagnosis || undefined,
                reportText: reportText || undefined,
                prescriptions: prescriptionsByRecord.get(r.id) || [],
              };
            });

          previousConsultationsSummary = await generatePatientHistorySummary(
            patientName,
            patient.medicalHistory,
            pastConsultations,
          );

          try {
            await storage.updatePatient(patient.id, {
              historySummary: previousConsultationsSummary,
              historySummaryAt: new Date(),
            } as any);
          } catch (cacheErr) {
            console.error("Error caching patient history summary:", cacheErr);
          }
        }
      } catch (err) {
        console.error("Error building patient history summary:", err);
      }
    }

    return {
      doctorName,
      patientName,
      patientAge,
      patientGender: patient?.gender ? (genderMap[patient.gender] || patient.gender) : undefined,
      patientAllergies: patient?.allergies || undefined,
      patientMedicalHistory: patient?.medicalHistory || undefined,
      consultationReason: appointment.notes || undefined,
      consultationType: appointment.consultationType || undefined,
      isNewPatient: previousConsultationsCount === 0,
      previousConsultationsCount,
      previousConsultationsSummary,
      currentClinicalRecord: clinicalRecord ? {
        chiefComplaint: clinicalRecord.chiefComplaint || undefined,
        symptoms: clinicalRecord.symptoms || undefined,
        diagnosis: clinicalRecord.diagnosis || undefined,
        notes: clinicalRecord.notes || undefined,
      } : undefined,
      transcript: clinicalRecord?.transcription || undefined,
    };
  }

  app.post("/api/consultations/:id/assistant/welcome", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      if (isNaN(appointmentId)) return res.status(400).json({ error: "ID inválido" });
      const userId = req.userId;

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.doctorId !== doctor.id) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const context = await buildAssistantContext(appointmentId, userId);
      const message = await generateAssistantWelcome(context);

      res.json({ message, context: { patientName: context.patientName, isNewPatient: context.isNewPatient, previousConsultationsCount: context.previousConsultationsCount } });
    } catch (error) {
      console.error("Error generating assistant welcome:", error);
      res.status(500).json({ error: "Error al generar mensaje de bienvenida" });
    }
  });

  const chatMessageSchema = z.object({
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2000),
    })).min(1).max(50),
  });

  app.post("/api/consultations/:id/assistant/chat", isAuthenticated, requireRole("staff"), async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      if (isNaN(appointmentId)) return res.status(400).json({ error: "ID inválido" });
      const userId = req.userId;

      const doctor = await storage.getDoctorByUserId(userId);
      if (!doctor) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment || appointment.doctorId !== doctor.id) {
        return res.status(403).json({ error: "No autorizado" });
      }

      const parsed = chatMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Datos de mensaje inválidos" });
      }

      const context = await buildAssistantContext(appointmentId, userId);
      const response = await chatWithAssistant(parsed.data.messages, context);

      res.json({ message: response });
    } catch (error) {
      console.error("Error in assistant chat:", error);
      res.status(500).json({ error: "Error al procesar consulta" });
    }
  });

  app.post("/api/consultations/:id/transcribe", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      
      // Update appointment status to in_progress
      await storage.updateAppointment(appointmentId, { status: "in_progress" });
      
      // In a real implementation, this would start real-time transcription
      // For now, we return a success response
      res.json({ success: true, message: "Transcription started" });
    } catch (error) {
      console.error("Error starting transcription:", error);
      res.status(500).json({ error: "Failed to start transcription" });
    }
  });

  // Audio transcription endpoint
  app.post("/api/transcribe", isAuthenticated, async (req: any, res) => {
    try {
      const { audioData } = req.body;
      
      if (!audioData) {
        return res.status(400).json({ error: "Audio data is required" });
      }
      
      const transcript = await transcribeAudio(audioData);
      res.json({ transcript });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  // Medical Instructions routes
  app.post("/api/medical-instructions", isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body against medicalInstructionSchema
      const validationResult = insertMedicalInstructionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const instructionData = validationResult.data;
      const instruction = await storage.createMedicalInstruction(instructionData);
      res.json(instruction);
    } catch (error) {
      console.error("Error creating medical instruction:", error);
      res.status(500).json({ error: "Failed to create medical instruction" });
    }
  });

  // Admin middleware
  const isAdmin = async (req: any, res: Response, next: Function) => {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      next();
    } catch (error) {
      res.status(500).json({ error: "Failed to verify admin status" });
    }
  };

  // Legacy /api/admin/users + /api/admin/promote-to-doctor removed.
  // Replaced by org-scoped requireRole("admin") versions below and POST /api/admin/doctors.

  app.get("/api/admin/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "Sesión inválida" });
      }
      const isStaff = user.role === "staff" || user.role === "doctor";
      res.json({
        isAdmin: user.role === "admin",
        role: isStaff ? "staff" : user.role,
        organizationId: user.organizationId || null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check admin status" });
    }
  });

  // ========================================================================
  // SUPER ADMIN routes (platform-level: organizations CRUD + platform stats)
  // ========================================================================
  app.get("/api/super-admin/organizations", isAuthenticated, requireRole("superAdmin"), async (_req, res) => {
    try {
      const orgs = await db.select().from(organizations).orderBy(ddesc(organizations.createdAt));
      // Decorate with counts
      const decorated = await Promise.all(orgs.map(async (org) => {
        const [{ doctorCount }] = await db.select({ doctorCount: dsql<number>`count(*)::int` })
          .from(doctors).where(eq(doctors.organizationId, org.id));
        const [{ adminCount }] = await db.select({ adminCount: dsql<number>`count(*)::int` })
          .from(users).where(and(eq(users.organizationId, org.id), eq(users.role, "admin")));
        return { ...org, doctorCount, adminCount };
      }));
      res.json(decorated);
    } catch (error) {
      console.error("Error listing organizations:", error);
      res.status(500).json({ error: "Failed to list organizations" });
    }
  });

  app.post("/api/super-admin/organizations", isAuthenticated, requireRole("superAdmin"), async (req, res) => {
    try {
      const parsed = insertOrganizationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", errors: parsed.error.flatten() });
      }
      const [created] = await db.insert(organizations).values(parsed.data).returning();
      res.json(created);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  app.put("/api/super-admin/organizations/:id", isAuthenticated, requireRole("superAdmin"), async (req, res) => {
    try {
      const id = String(req.params.id);
      const parsed = insertOrganizationSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", errors: parsed.error.flatten() });
      }
      const [updated] = await db.update(organizations).set(parsed.data).where(eq(organizations.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Organization not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(500).json({ error: "Failed to update organization" });
    }
  });

  app.delete("/api/super-admin/organizations/:id", isAuthenticated, requireRole("superAdmin"), async (req, res) => {
    try {
      const id = String(req.params.id);
      // Soft-deactivate to avoid breaking referenced doctors/users.
      const [updated] = await db.update(organizations).set({ isActive: false }).where(eq(organizations.id, id)).returning();
      if (!updated) return res.status(404).json({ error: "Organization not found" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error deactivating organization:", error);
      res.status(500).json({ error: "Failed to deactivate organization" });
    }
  });

  // Create an admin user for a given organization
  app.post("/api/super-admin/organizations/:id/admins", isAuthenticated, requireRole("superAdmin"), async (req, res) => {
    try {
      const orgId = String(req.params.id);
      const schema = z.object({
        rut: z.string().min(3),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", errors: parsed.error.flatten() });
      }
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      if (!org) return res.status(404).json({ error: "Organization not found" });

      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const newUserId = `user_admin_${Math.random().toString(36).slice(2, 10)}`;
      const [created] = await db.insert(users).values({
        id: newUserId,
        rut: parsed.data.rut,
        username: parsed.data.rut,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        passwordHash,
        role: "admin",
        organizationId: orgId,
        isAdmin: true,
      }).returning();
      const { passwordHash: _, ...safe } = created;
      res.json(safe);
    } catch (error: any) {
      if (String(error?.message || "").includes("duplicate")) {
        return res.status(409).json({ error: "Ya existe un usuario con ese RUT o email" });
      }
      console.error("Error creating org admin:", error);
      res.status(500).json({ error: "Failed to create org admin" });
    }
  });

  // List all users with their roles. Used by superAdmin to pick who to promote.
  app.get("/api/super-admin/users", isAuthenticated, requireRole("superAdmin"), async (_req, res) => {
    try {
      const allUsers = await db.select().from(users);
      const allDocs = await db.select().from(doctors);
      const doctorByUserId = new Map(allDocs.map((d) => [d.userId, d]));
      const decorated = allUsers.map((u) => {
        const { passwordHash, ...safe } = u;
        const doc = doctorByUserId.get(u.id) || null;
        return {
          ...safe,
          doctor: doc
            ? {
                id: doc.id,
                specialty: doc.specialty,
                licenseNumber: doc.licenseNumber,
                consultationFee: doc.consultationFee,
                organizationId: doc.organizationId,
                isActive: doc.isActive,
              }
            : null,
        };
      });
      res.json(decorated);
    } catch (error) {
      console.error("Error listing users for super-admin:", error);
      res.status(500).json({ error: "Failed to list users" });
    }
  });

  // Promote a user to doctor capability. Creates an unattached doctor row.
  app.post("/api/super-admin/users/:userId/promote-doctor", isAuthenticated, requireRole("superAdmin"), async (req, res) => {
    try {
      const { userId } = req.params;
      const schema = z.object({
        specialty: z.string().min(1),
        licenseNumber: z.string().min(1),
        consultationFee: z.number().int().min(0).default(25000),
        bio: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", errors: parsed.error.flatten() });
      }

      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
      if (target.role !== "patient") {
        return res.status(409).json({ error: "Sólo se puede promover a un paciente" });
      }

      // If they already have a doctor row (from a previous promotion), reactivate it instead of creating a new one.
      const [existingDoc] = await db.select().from(doctors).where(eq(doctors.userId, userId));

      const result = await db.transaction(async (tx) => {
        const [updatedUser] = await tx
          .update(users)
          .set({ role: "doctor" })
          .where(eq(users.id, userId))
          .returning();
        let doc;
        if (existingDoc) {
          [doc] = await tx
            .update(doctors)
            .set({
              specialty: parsed.data.specialty,
              licenseNumber: parsed.data.licenseNumber,
              consultationFee: parsed.data.consultationFee,
              bio: parsed.data.bio ?? null,
              isActive: true,
            })
            .where(eq(doctors.id, existingDoc.id))
            .returning();
        } else {
          [doc] = await tx
            .insert(doctors)
            .values({
              userId,
              organizationId: null,
              specialty: parsed.data.specialty,
              licenseNumber: parsed.data.licenseNumber,
              consultationFee: parsed.data.consultationFee,
              bio: parsed.data.bio ?? null,
            })
            .returning();
        }
        return { user: updatedUser, doctor: doc };
      });

      const { passwordHash, ...safe } = result.user;
      res.json({ user: safe, doctor: result.doctor });
    } catch (error) {
      console.error("Error promoting user to doctor:", error);
      res.status(500).json({ error: "Failed to promote user" });
    }
  });

  // Revoke a user's doctor capability. Reverts role to patient and deactivates the doctor row.
  // The doctor row is kept (soft-delete via isActive=false) to preserve historical appointments.
  app.delete("/api/super-admin/users/:userId/promote-doctor", isAuthenticated, requireRole("superAdmin"), async (req, res) => {
    try {
      const { userId } = req.params;
      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
      if (target.role !== "doctor") {
        return res.status(409).json({ error: "El usuario no tiene rol médico activo" });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ role: "patient", organizationId: null })
          .where(eq(users.id, userId));
        await tx
          .update(doctors)
          .set({ isActive: false, organizationId: null })
          .where(eq(doctors.userId, userId));
      });

      res.json({ ok: true });
    } catch (error) {
      console.error("Error revoking doctor capability:", error);
      res.status(500).json({ error: "Failed to revoke doctor capability" });
    }
  });

  app.get("/api/super-admin/stats", isAuthenticated, requireRole("superAdmin"), async (_req, res) => {
    try {
      const [orgCount] = await db.select({ c: dsql<number>`count(*)::int` }).from(organizations);
      const [doctorCount] = await db.select({ c: dsql<number>`count(*)::int` }).from(doctors);
      const [patientCount] = await db.select({ c: dsql<number>`count(*)::int` }).from(patients);
      const [userCount] = await db.select({ c: dsql<number>`count(*)::int` }).from(users);
      const [apptCount] = await db.select({ c: dsql<number>`count(*)::int` }).from(appointments);
      const [revenueRow] = await db.select({
        total: dsql<number>`COALESCE(SUM(${doctors.consultationFee}), 0)::int`
      })
        .from(appointments)
        .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
        .where(eq(appointments.paymentStatus, "paid"));
      res.json({
        organizations: orgCount.c,
        doctors: doctorCount.c,
        patients: patientCount.c,
        users: userCount.c,
        appointments: apptCount.c,
        totalRevenue: revenueRow.total,
      });
    } catch (error) {
      console.error("Error fetching super-admin stats:", error);
      res.status(500).json({ error: "Failed to fetch platform stats" });
    }
  });

  // ========================================================================
  // ORG ADMIN routes (scoped to admin's organization)
  // ========================================================================
  async function getRequestOrgId(req: any): Promise<string | null> {
    if ((req as any).userOrgId) return (req as any).userOrgId as string;
    const user = await storage.getUser(req.userId);
    return user?.organizationId || null;
  }

  app.get("/api/admin/me/organization", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      if (!orgId) return res.status(404).json({ error: "Sin organización asignada" });
      const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      res.json(org || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      if (!orgId) return res.status(404).json({ error: "Sin organización asignada" });

      const orgStaff = await db.select().from(doctors).where(eq(doctors.organizationId, orgId));
      const activeStaff = orgStaff.filter((d) => d.isActive !== false);

      const allResidents = await storage.getAllPatients();
      const pendingTasksRaw = await storage.getAllPendingResidentCareTasks();
      const now = new Date();

      const recentTasks = sortByUrgency(
        pendingTasksRaw.map((t) => ({
          id: t.id,
          text: t.text,
          dueAt: t.dueAt.toISOString(),
          patientId: t.patientId,
          patientName: t.patientName,
          rut: t.rut,
          createdByName: t.createdByName,
          urgency: getTaskUrgency(t.dueAt.toISOString(), now),
        })),
        now,
      ).slice(0, 12);

      const allUrgency = { critical: 0, warning: 0, normal: 0 };
      for (const t of pendingTasksRaw) {
        const u = getTaskUrgency(t.dueAt.toISOString(), now);
        allUrgency[u] += 1;
      }

      const [resolvedRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(residentCareTasks)
        .where(eq(residentCareTasks.resolved, true));

      res.json({
        staffCount: activeStaff.length,
        residentCount: allResidents.length,
        pendingTasks: pendingTasksRaw.length,
        criticalTasks: allUrgency.critical,
        warningTasks: allUrgency.warning,
        normalTasks: allUrgency.normal,
        resolvedTasks: resolvedRow?.count ?? 0,
        recentTasks,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // List users in admin's org (doctors + admins)
  app.get("/api/admin/users", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      if (!orgId) return res.json([]);
      const orgUsers = await db.select().from(users).where(eq(users.organizationId, orgId));
      const decorated = await Promise.all(orgUsers.map(async (u) => {
        const { passwordHash, ...safe } = u;
        const doctor = await storage.getDoctorByUserId(u.id);
        return {
          ...safe,
          doctorId: doctor?.id || null,
          specialty: doctor?.specialty || null,
          licenseNumber: doctor?.licenseNumber || null,
          consultationFee: doctor?.consultationFee || null,
          bio: doctor?.bio || null,
          isActive: doctor?.isActive ?? null,
        };
      }));
      res.json(decorated);
    } catch (error) {
      console.error("Error listing org users:", error);
      res.status(500).json({ error: "Failed to list users" });
    }
  });

  // Org admin creates staff in their org
  app.post("/api/admin/staff", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Sin organización asignada" });

      const schema = z.object({
        rut: z.string().min(3),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        specialty: z.string().min(1).default("Cuidado de residentes"),
        licenseNumber: z.string().optional().default(""),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", errors: parsed.error.flatten() });
      }

      const cleanedRut = parsed.data.rut.replace(/\./g, "");
      const [existingByRut] = await db.select().from(users).where(eq(users.rut, cleanedRut));
      if (existingByRut) {
        return res.status(409).json({ error: "Ya existe un usuario con este RUT" });
      }
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, parsed.data.email));
      if (existingByEmail) {
        return res.status(409).json({ error: "Ya existe un usuario con este correo" });
      }

      const passwordHash = await bcrypt.hash(parsed.data.password, 10);
      const newUserId = `user_staff_${Math.random().toString(36).slice(2, 10)}`;

      const [createdUser] = await db.insert(users).values({
        id: newUserId,
        rut: cleanedRut,
        username: cleanedRut,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        passwordHash,
        role: "staff",
        organizationId: orgId,
        isAdmin: false,
      }).returning();

      const [createdDoctor] = await db.insert(doctors).values({
        userId: newUserId,
        organizationId: orgId,
        specialty: parsed.data.specialty,
        licenseNumber: parsed.data.licenseNumber || "—",
        consultationFee: 0,
      }).returning();

      const { passwordHash: _, ...safe } = createdUser;
      res.status(201).json({ ...safe, doctorId: createdDoctor.id });
    } catch (error: any) {
      console.error("Error creating staff:", error);
      res.status(500).json({ error: "No se pudo crear el usuario staff" });
    }
  });

  app.post("/api/admin/doctors", isAuthenticated, requireRole("admin"), async (_req, res) => {
    res.status(410).json({
      error: "Usa POST /api/admin/staff para crear personal del centro.",
    });
  });

  // Org admin edits staff profile
  app.put("/api/admin/doctors/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      const doctorId = parseInt(req.params.id);
      const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
      if (!doc || doc.organizationId !== orgId) return res.status(404).json({ error: "Personal no encontrado en su organización" });

      const schema = z.object({
        specialty: z.string().optional(),
        licenseNumber: z.string().optional(),
        bio: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", errors: parsed.error.flatten() });
      }
      const [updated] = await db.update(doctors).set(parsed.data).where(eq(doctors.id, doctorId)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating doctor:", error);
      res.status(500).json({ error: "Failed to update doctor" });
    }
  });

  // Org admin updates doctor availability (schedule editing)
  app.put("/api/admin/doctors/:id/availability", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      const doctorId = parseInt(req.params.id);
      const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
      if (!doc || doc.organizationId !== orgId) return res.status(404).json({ error: "Doctor no encontrado en su organización" });

      const schema = z.object({
        availability: z.record(z.string(), z.array(z.object({
          start: z.string().regex(/^\d{2}:\d{2}$/),
          end: z.string().regex(/^\d{2}:\d{2}$/),
        }))),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", errors: parsed.error.flatten() });
      }
      const [updated] = await db.update(doctors).set({ availability: parsed.data.availability }).where(eq(doctors.id, doctorId)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating availability:", error);
      res.status(500).json({ error: "Failed to update availability" });
    }
  });

  // Org admin deletes user (soft via isActive on doctor; users get deleted)
  app.delete("/api/admin/users/:id", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      const userId = req.params.id;
      if (userId === req.userId) return res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
      const [target] = await db.select().from(users).where(eq(users.id, userId));
      if (!target || target.organizationId !== orgId) {
        return res.status(404).json({ error: "Usuario no encontrado en su organización" });
      }
      // Staff: deactivate clinical profile
      const doc = await storage.getDoctorByUserId(userId);
      if (doc && (target.role === "staff" || target.role === "doctor")) {
        await db.update(doctors).set({ isActive: false }).where(eq(doctors.id, doc.id));
      }
      // For admins remove the user row outright (no FKs)
      if (target.role === "admin") {
        await db.delete(users).where(eq(users.id, userId));
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Org admin lists doctors of their org with availability info
  // Promoted-but-unattached doctors. Org admin picks from this list to attach to their org.
  app.get("/api/admin/doctors/available", isAuthenticated, requireRole("admin"), async (_req, res) => {
    try {
      const freeDocs = await db
        .select()
        .from(doctors)
        .where(and(eq(doctors.isActive, true), dsql`${doctors.organizationId} IS NULL`));
      const decorated = await Promise.all(
        freeDocs.map(async (d) => {
          const [u] = await db.select().from(users).where(eq(users.id, d.userId));
          return {
            id: d.id,
            userId: d.userId,
            specialty: d.specialty,
            licenseNumber: d.licenseNumber,
            consultationFee: d.consultationFee,
            firstName: u?.firstName || null,
            lastName: u?.lastName || null,
            email: u?.email || null,
            rut: u?.rut || null,
          };
        })
      );
      res.json(decorated);
    } catch (error) {
      console.error("Error listing available doctors:", error);
      res.status(500).json({ error: "Failed to list available doctors" });
    }
  });

  // Attach a free (already promoted) doctor to the admin's organization.
  app.post("/api/admin/doctors/:id/attach", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Sin organización asignada" });
      const doctorId = parseInt(req.params.id);
      const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
      if (!doc) return res.status(404).json({ error: "Médico no encontrado" });
      if (doc.organizationId) {
        return res.status(409).json({ error: "El médico ya pertenece a una organización" });
      }
      if (!doc.isActive) {
        return res.status(409).json({ error: "El médico está inactivo" });
      }
      await db.transaction(async (tx) => {
        await tx.update(doctors).set({ organizationId: orgId }).where(eq(doctors.id, doctorId));
        await tx.update(users).set({ organizationId: orgId }).where(eq(users.id, doc.userId));
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error attaching doctor:", error);
      res.status(500).json({ error: "Failed to attach doctor" });
    }
  });

  // Detach a doctor from the admin's organization (back to the unattached pool).
  app.delete("/api/admin/doctors/:id/attach", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      if (!orgId) return res.status(400).json({ error: "Sin organización asignada" });
      const doctorId = parseInt(req.params.id);
      const [doc] = await db.select().from(doctors).where(eq(doctors.id, doctorId));
      if (!doc || doc.organizationId !== orgId) {
        return res.status(404).json({ error: "Médico no encontrado en su organización" });
      }
      await db.transaction(async (tx) => {
        await tx.update(doctors).set({ organizationId: null }).where(eq(doctors.id, doctorId));
        await tx.update(users).set({ organizationId: null }).where(eq(users.id, doc.userId));
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error detaching doctor:", error);
      res.status(500).json({ error: "Failed to detach doctor" });
    }
  });

  app.get("/api/admin/doctors", isAuthenticated, requireRole("admin"), async (req: any, res) => {
    try {
      const orgId = await getRequestOrgId(req);
      if (!orgId) return res.json([]);
      const docs = await db.select().from(doctors).where(eq(doctors.organizationId, orgId));
      const decorated = await Promise.all(docs.map(async (d) => {
        const [u] = await db.select().from(users).where(eq(users.id, d.userId));
        return {
          ...d,
          firstName: u?.firstName || null,
          lastName: u?.lastName || null,
          email: u?.email || null,
        };
      }));
      res.json(decorated);
    } catch (error) {
      console.error("Error listing org doctors:", error);
      res.status(500).json({ error: "Failed to list doctors" });
    }
  });

  // Fitbit OAuth2 Integration
  app.get("/api/fitbit/connections", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });
      const connections = await storage.getWearableConnections(patient.id);
      const safe = connections.map(c => ({
        id: c.id,
        provider: c.provider,
        providerUserId: c.providerUserId,
        scopes: c.scopes,
        lastSyncAt: c.lastSyncAt,
        isActive: c.isActive,
        createdAt: c.createdAt,
      }));
      res.json(safe);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener conexiones" });
    }
  });

  app.post("/api/fitbit/authorize", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      const existing = await storage.getWearableConnection(patient.id, "fitbit");
      if (existing && existing.isActive) {
        return res.status(400).json({ error: "Ya tienes Fitbit conectado. Desconéctalo primero." });
      }

      const authUrl = getFitbitAuthUrl(patient.id, req.userId);
      res.json({ authUrl });
    } catch (error) {
      console.error("Fitbit authorize error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Error al iniciar autorización Fitbit" });
    }
  });

  app.get("/api/fitbit/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        return res.redirect("/health-data?fitbit=error&reason=missing_params");
      }

      const pending = getAndRemovePendingState(state as string);
      if (!pending) {
        return res.redirect("/health-data?fitbit=error&reason=invalid_state");
      }

      const tokens = await exchangeCodeForTokens(code as string, pending.codeVerifier);

      const existing = await storage.getWearableConnection(pending.patientId, "fitbit");
      if (existing) {
        await storage.updateWearableConnection(existing.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          providerUserId: tokens.user_id,
          scopes: tokens.scope,
          isActive: true,
        });
      } else {
        await storage.createWearableConnection({
          patientId: pending.patientId,
          provider: "fitbit",
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          providerUserId: tokens.user_id,
          scopes: tokens.scope,
          isActive: true,
        });
      }

      res.redirect("/health-data?fitbit=connected");
    } catch (error) {
      console.error("Fitbit callback error:", error);
      res.redirect("/health-data?fitbit=error&reason=token_exchange");
    }
  });

  app.post("/api/fitbit/sync", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      const connection = await storage.getWearableConnection(patient.id, "fitbit");
      if (!connection || !connection.isActive) {
        return res.status(400).json({ error: "Fitbit no está conectado" });
      }

      let accessToken = connection.accessToken;
      if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) <= new Date()) {
        if (!connection.refreshToken) {
          return res.status(401).json({ error: "Token expirado. Reconecta Fitbit." });
        }
        const newTokens = await refreshFitbitTokens(connection.refreshToken);
        accessToken = newTokens.access_token;
        await storage.updateWearableConnection(connection.id, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token,
          tokenExpiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        });
      }

      const fitbitMetrics = await fetchFitbitData(accessToken);

      if (fitbitMetrics.length > 0) {
        for (const m of fitbitMetrics) {
          // Evitar duplicados (mismo paciente, tipo y fecha/hora aproximada)
          // También ignorar valores estáticos que han causado problemas
          const existing = await storage.getWearableMetrics(patient.id, {
            metricType: m.metricType,
            from: new Date(new Date(m.recordedAt).getTime() - 60000).toISOString(), // Ventana de 1 minuto
            to: new Date(new Date(m.recordedAt).getTime() + 60000).toISOString(),
          });
          
          if (existing.length === 0) {
            await storage.createWearableMetrics([{
              patientId: patient.id,
              metricType: m.metricType,
              value: m.value,
              unit: m.unit,
              recordedAt: m.recordedAt,
              source: "fitbit",
              deviceName: "Fitbit",
            }]);
          }
        }
      }

      await storage.updateWearableConnection(connection.id, {
        lastSyncAt: new Date(),
      });

      res.json({ synced: fitbitMetrics.length });
    } catch (error) {
      console.error("Fitbit sync error:", error);
      res.status(500).json({ error: "Error al sincronizar datos de Fitbit" });
    }
  });

  app.delete("/api/fitbit/disconnect", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      await storage.deleteWearableConnection(patient.id, "fitbit");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al desconectar Fitbit" });
    }
  });

  // Wearable Metrics
  const VALID_METRIC_TYPES = ["heart_rate", "steps", "sleep_duration", "spo2", "bp_systolic", "bp_diastolic", "weight", "temperature", "calories"];
  const VALID_SOURCES = ["manual", "apple_health", "google_fit", "fitbit", "garmin", "samsung", "whoop", "oura", "csv_import"];

  app.get("/api/wearable-metrics", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      const { metricType, from, to, source } = req.query;
      const metrics = await storage.getWearableMetrics(patient.id, {
        metricType: metricType as string,
        from: from as string,
        to: to as string,
        source: source as string,
      });
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener métricas" });
    }
  });

  app.get("/api/wearable-metrics/summary", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      const { from, to } = req.query;
      const summary = await storage.getWearableMetricsSummary(patient.id, from as string, to as string);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen" });
    }
  });

  app.get("/api/wearable-metrics/latest", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      const latest = await storage.getLatestWearableMetrics(patient.id);
      res.json(latest);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener últimas métricas" });
    }
  });

  app.post("/api/wearable-metrics", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      const { metricType, value, unit, recordedAt, source } = req.body;
      if (!metricType || value === undefined || !unit) {
        return res.status(400).json({ error: "Tipo de métrica, valor y unidad son requeridos" });
      }
      if (!VALID_METRIC_TYPES.includes(metricType)) {
        return res.status(400).json({ error: `Tipo de métrica inválido. Válidos: ${VALID_METRIC_TYPES.join(", ")}` });
      }
      const numValue = parseFloat(String(value));
      if (isNaN(numValue)) {
        return res.status(400).json({ error: "El valor debe ser numérico" });
      }
      const src = source || 'manual';
      if (!VALID_SOURCES.includes(src)) {
        return res.status(400).json({ error: "Fuente inválida" });
      }

      const metric = await storage.createWearableMetric({
        patientId: patient.id,
        metricType,
        value: String(numValue),
        unit,
        recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
        source: src,
      });
      res.json(metric);
    } catch (error) {
      res.status(500).json({ error: "Error al crear métrica" });
    }
  });

  app.post("/api/wearable-metrics/batch", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      const { metrics } = req.body;
      if (!Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ error: "Se requiere un arreglo de métricas" });
      }
      if (metrics.length > 500) {
        return res.status(400).json({ error: "Máximo 500 métricas por lote" });
      }

      const prepared = [];
      for (const m of metrics) {
        if (!m.metricType || !VALID_METRIC_TYPES.includes(m.metricType)) continue;
        const val = parseFloat(String(m.value));
        if (isNaN(val)) continue;
        const src = m.source || 'manual';
        prepared.push({
          patientId: patient.id,
          metricType: m.metricType,
          value: String(val),
          unit: m.unit || "",
          recordedAt: m.recordedAt ? new Date(m.recordedAt) : new Date(),
          source: VALID_SOURCES.includes(src) ? src : 'manual',
          notes: m.notes || null,
          deviceName: m.deviceName || null,
        });
      }

      if (prepared.length === 0) {
        return res.status(400).json({ error: "No se encontraron métricas válidas" });
      }

      const created = await storage.createWearableMetrics(prepared);
      res.json({ count: created.length });
    } catch (error) {
      res.status(500).json({ error: "Error al importar métricas" });
    }
  });

  app.delete("/api/wearable-metrics/:id", isAuthenticated, async (req: any, res) => {
    try {
      const patient = await storage.getPatientByUserId(req.userId);
      if (!patient) return res.status(404).json({ error: "Perfil de paciente no encontrado" });

      await storage.deleteWearableMetric(parseInt(req.params.id), patient.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Error al eliminar métrica" });
    }
  });

  // Doctor: Get patient wearable metrics for consultation
  app.get("/api/doctor/patients/:patientId/wearable-metrics", isAuthenticated, async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "Solo médicos pueden acceder" });

      const patientId = parseInt(req.params.patientId);
      const { metricType, from, to } = req.query;
      const metrics = await storage.getWearableMetrics(patientId, {
        metricType: metricType as string,
        from: from as string,
        to: to as string,
      });
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener métricas del paciente" });
    }
  });

  app.get("/api/doctor/patients/:patientId/wearable-metrics/summary", isAuthenticated, async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "Solo médicos pueden acceder" });

      const patientId = parseInt(req.params.patientId);
      const { from, to } = req.query;
      const summary = await storage.getWearableMetricsSummary(patientId, from as string, to as string);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener resumen del paciente" });
    }
  });

  app.post("/api/doctor/patients/:patientId/wearable-metrics/ai-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const doctor = await storage.getDoctorByUserId(req.userId);
      if (!doctor) return res.status(403).json({ error: "Solo médicos pueden acceder" });

      const patientId = parseInt(req.params.patientId);
      const summary = await storage.getWearableMetricsSummary(patientId);
      const latest = await storage.getLatestWearableMetrics(patientId);

      if (summary.length === 0) {
        return res.json({ analysis: "No hay datos de dispositivos wearable disponibles para este paciente." });
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });
      const prompt = `Eres un asistente médico. Analiza los siguientes datos de salud de un paciente recopilados de dispositivos wearable y entrada manual. Proporciona un resumen clínico breve en español, destacando:
1. Valores fuera de rango normal
2. Tendencias preocupantes
3. Recomendaciones para el médico

Resumen de métricas:
${summary.map(s => `- ${s.metricType}: Promedio=${s.avg.toFixed(1)}, Min=${s.min}, Max=${s.max}, Último=${s.latestValue} ${s.unit} (${s.count} registros)`).join('\n')}

Últimas lecturas:
${latest.map(l => `- ${l.metricType}: ${l.value} ${l.unit} (${new Date(l.recordedAt).toLocaleDateString('es-CL')})`).join('\n')}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
      });

      res.json({ analysis: response.choices[0]?.message?.content || "No se pudo generar el análisis." });
    } catch (error: any) {
      console.error("AI analysis error:", error);
      res.status(500).json({ error: "Error al generar análisis de IA" });
    }
  });

  // Chat file upload configuration
  const uploadsDir = path.resolve(process.cwd(), 'uploads', 'chat');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ];

  const chatUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de archivo no permitido'));
      }
    }
  });

  app.get('/uploads/chat/:filename', (req: Request, res: Response) => {
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    if (!token) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env.SESSION_SECRET!);
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  });

  // Consultation Chat Messages
  app.get("/api/consultations/:id/messages", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Cita no encontrada" });

      const userId = (req as any).userId;
      const patient = await storage.getPatientByUserId(userId);
      const doctor = await storage.getDoctorByUserId(userId);
      const isPatient = patient && appointment.patientId === patient.id;
      const isDoctor = doctor && appointment.doctorId === doctor.id;
      if (!isPatient && !isDoctor) return res.status(403).json({ error: "No autorizado" });

      const messages = await storage.getConsultationMessages(appointmentId);

      const userCache = new Map<string, { firstName: string; lastName: string }>();
      const enriched = await Promise.all(messages.map(async (msg) => {
        if (!userCache.has(msg.senderUserId)) {
          const u = await storage.getUser(msg.senderUserId);
          userCache.set(msg.senderUserId, {
            firstName: u?.firstName || '',
            lastName: u?.lastName || ''
          });
        }
        const sender = userCache.get(msg.senderUserId)!;
        return {
          ...msg,
          senderName: `${sender.firstName} ${sender.lastName}`.trim() || 'Usuario'
        };
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Error al obtener mensajes" });
    }
  });

  app.post("/api/consultations/:id/messages", isAuthenticated, chatUpload.single('file'), async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Cita no encontrada" });

      const userId = (req as any).userId;
      const patient = await storage.getPatientByUserId(userId);
      const doctor = await storage.getDoctorByUserId(userId);
      const isPatient = patient && appointment.patientId === patient.id;
      const isDoctorUser = doctor && appointment.doctorId === doctor.id;
      if (!isPatient && !isDoctorUser) return res.status(403).json({ error: "No autorizado" });

      const content = req.body.content || null;
      const file = req.file;

      if (!content && !file) {
        return res.status(400).json({ error: "Debe enviar un mensaje o archivo" });
      }

      const senderRole = isDoctorUser ? 'doctor' : 'patient';
      const messageData: any = {
        appointmentId,
        senderUserId: userId,
        senderRole,
        content,
      };

      if (file) {
        messageData.fileName = file.originalname;
        messageData.fileUrl = `/uploads/chat/${file.filename}`;
        messageData.fileType = file.mimetype;
        messageData.fileSize = file.size;
      }

      const message = await storage.createConsultationMessage(messageData);

      const user = await storage.getUser(userId);
      const enrichedMessage = {
        ...message,
        senderName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Usuario'
      };

      const roomId = `consultation-${appointmentId}`;
      const room = signalingRooms.get(roomId);
      if (room) {
        const chatPayload = JSON.stringify({
          type: 'chat-message',
          message: enrichedMessage
        });
        room.participants.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(chatPayload);
          }
        });
      }

      res.json(enrichedMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Error al enviar mensaje" });
    }
  });

  // Consultation Ratings
  app.get("/api/consultations/:id/rating", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = (req as any).userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Cita no encontrada" });

      const patient = await storage.getPatientByUserId(userId);
      const doctor = await storage.getDoctorByUserId(userId);
      const isPatient = patient && appointment.patientId === patient.id;
      const isDoctorUser = doctor && appointment.doctorId === doctor.id;
      if (!isPatient && !isDoctorUser) return res.status(403).json({ error: "No autorizado" });

      const rating = await storage.getConsultationRating(appointmentId);
      res.json(rating || null);
    } catch (error) {
      res.status(500).json({ error: "Error al obtener calificación" });
    }
  });

  app.post("/api/consultations/:id/rating", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const appointmentId = parseInt(req.params.id as string);
      const userId = (req as any).userId;

      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) return res.status(404).json({ error: "Cita no encontrada" });

      const patient = await storage.getPatientByUserId(userId);
      if (!patient || appointment.patientId !== patient.id) {
        return res.status(403).json({ error: "Solo el paciente puede calificar" });
      }

      const existing = await storage.getConsultationRating(appointmentId);
      if (existing) {
        return res.status(400).json({ error: "Ya has calificado esta consulta" });
      }

      const { doctorRating, doctorComment, platformRating, platformComment } = req.body;
      if (!doctorRating || doctorRating < 1 || doctorRating > 5) {
        return res.status(400).json({ error: "Calificación del médico requerida (1-5)" });
      }

      const rating = await storage.createConsultationRating({
        appointmentId,
        patientUserId: userId,
        doctorRating,
        doctorComment: doctorComment || null,
        platformRating: platformRating || null,
        platformComment: platformComment || null,
      });

      res.json(rating);
    } catch (error) {
      console.error("Error creating rating:", error);
      res.status(500).json({ error: "Error al guardar calificación" });
    }
  });

  // WebRTC Signaling Server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', async (ws: WebSocket, req) => {
    let currentRoom: string | null = null;
    let participantId: string | null = null;
    let isAuthenticated = false;
    let authenticatedUserId: string | null = null;

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'ping': {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pong' }));
            }
            break;
          }

          case 'join': {
            const { roomId, userId, appointmentId } = message;
            
            // Validate userId is provided
            if (!userId) {
              ws.send(JSON.stringify({ type: 'error', message: 'User ID required' }));
              return;
            }

            // Require appointmentId for all joins
            if (!appointmentId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Appointment ID required' }));
              return;
            }

            // Validate appointment access
            let userIsDoctor = false;
            try {
              const appointment = await storage.getAppointment(parseInt(appointmentId));
              if (!appointment) {
                ws.send(JSON.stringify({ type: 'error', message: 'Appointment not found' }));
                return;
              }

              // Check if user is the patient or doctor for this appointment
              const patient = await storage.getPatientByUserId(userId);
              const doctor = await storage.getDoctorByUserId(userId);
              
              const isPatient = patient && appointment.patientId === patient.id;
              userIsDoctor = !!(doctor && appointment.doctorId === doctor.id);
              
              if (!isPatient && !userIsDoctor) {
                ws.send(JSON.stringify({ type: 'error', message: 'Not authorized to join this consultation' }));
                log(`Unauthorized join attempt: user ${userId} for appointment ${appointmentId}`);
                return;
              }
              
              isAuthenticated = true;
              authenticatedUserId = userId;
            } catch (err) {
              console.error('Error validating appointment access:', err);
              ws.send(JSON.stringify({ type: 'error', message: 'Authorization failed' }));
              return;
            }

            currentRoom = roomId;
            const newParticipantId = userId;
            participantId = newParticipantId;

            if (!signalingRooms.has(roomId)) {
              signalingRooms.set(roomId, { participants: new Map(), waitingPatients: new Map() });
            }

            const room = signalingRooms.get(roomId)!;

            // If this user is already in the room (reconnecting), remove old connection first
            if (room.participants.has(newParticipantId)) {
              const oldWs = room.participants.get(newParticipantId);
              if (oldWs && oldWs !== ws && oldWs.readyState === WebSocket.OPEN) {
                try { oldWs.close(); } catch {}
              }
              room.participants.delete(newParticipantId);
              log(`Removed stale connection for ${newParticipantId} in room ${roomId}`);
            }
            // Also check waiting patients for stale connections
            if (room.waitingPatients.has(newParticipantId)) {
              const oldEntry = room.waitingPatients.get(newParticipantId);
              if (oldEntry && oldEntry.ws !== ws && oldEntry.ws.readyState === WebSocket.OPEN) {
                try { oldEntry.ws.close(); } catch {}
              }
              room.waitingPatients.delete(newParticipantId);
              log(`Removed stale waiting entry for ${newParticipantId} in room ${roomId}`);
            }
            
            // Limit to 2 participants per consultation room
            if (room.participants.size >= 2 && !room.participants.has(newParticipantId)) {
              ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
              return;
            }

            // If user is a doctor, join directly and mark as room's doctor
            if (userIsDoctor) {
              room.doctorUserId = newParticipantId;
              room.participants.set(newParticipantId, ws);
              log(`Doctor ${participantId} joined room ${roomId}. Total: ${room.participants.size}`);

              // Notify other participants that someone joined
              room.participants.forEach((client, odient) => {
                if (odient !== participantId && client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'user-joined',
                    odientId: participantId
                  }));
                }
              });

              // Notify the joiner about existing participants
              const existingParticipants = Array.from(room.participants.keys()).filter(id => id !== participantId);
              ws.send(JSON.stringify({
                type: 'room-joined',
                roomId,
                participants: existingParticipants
              }));

              // Notify doctor of any patients already waiting
              room.waitingPatients.forEach((entry, waitingId) => {
                ws.send(JSON.stringify({
                  type: 'patient-waiting',
                  patientId: waitingId,
                  patientName: entry.patientName
                }));
              });
            } else {
              // Patient: put them in the waiting room
              const patientUser = await storage.getUser(userId);
              const patientName = patientUser
                ? `${patientUser.firstName || ''} ${patientUser.lastName || ''}`.trim() || 'Paciente'
                : 'Paciente';

              room.waitingPatients.set(newParticipantId, { ws, userId, patientName });
              log(`Patient ${participantId} placed in waiting room for ${roomId}`);

              // Tell the patient they are waiting
              ws.send(JSON.stringify({ type: 'waiting-room' }));

              // Notify the doctor (if present) that a patient is waiting
              if (room.doctorUserId && room.participants.has(room.doctorUserId)) {
                const doctorWs = room.participants.get(room.doctorUserId);
                if (doctorWs && doctorWs.readyState === WebSocket.OPEN) {
                  doctorWs.send(JSON.stringify({
                    type: 'patient-waiting',
                    patientId: newParticipantId,
                    patientName
                  }));
                }
              }
            }
            break;
          }

          case 'offer':
          case 'answer':
          case 'ice-candidate': {
            if (!currentRoom) break;
            
            const room = signalingRooms.get(currentRoom);
            if (!room) break;

            const targetClient = room.participants.get(message.target);
            if (targetClient && targetClient.readyState === WebSocket.OPEN) {
              targetClient.send(JSON.stringify({
                ...message,
                from: participantId
              }));
            }
            break;
          }

          case 'admit-patient': {
            const { patientId: admitId, roomId: admitRoom } = message;
            const targetRoom = signalingRooms.get(admitRoom || currentRoom || '');
            if (!targetRoom) break;

            // Only the doctor can admit patients
            if (authenticatedUserId !== targetRoom.doctorUserId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Only the doctor can admit patients' }));
              break;
            }

            const waitingEntry = targetRoom.waitingPatients.get(admitId);
            if (!waitingEntry) break;

            targetRoom.waitingPatients.delete(admitId);
            targetRoom.participants.set(admitId, waitingEntry.ws);
            log(`Patient ${admitId} admitted to room ${admitRoom || currentRoom}`);

            // Notify the patient they've been admitted
            if (waitingEntry.ws.readyState === WebSocket.OPEN) {
              waitingEntry.ws.send(JSON.stringify({ type: 'patient-admitted' }));

              // Send room-joined with existing participants to the patient
              const existingPeers = Array.from(targetRoom.participants.keys()).filter(id => id !== admitId);
              waitingEntry.ws.send(JSON.stringify({
                type: 'room-joined',
                roomId: admitRoom || currentRoom,
                participants: existingPeers
              }));
            }

            // Notify existing participants about the new user
            targetRoom.participants.forEach((client, pid) => {
              if (pid !== admitId && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'user-joined',
                  odientId: admitId
                }));
              }
            });
            break;
          }

          case 'deny-patient': {
            const { patientId: denyId, roomId: denyRoom } = message;
            const denyTargetRoom = signalingRooms.get(denyRoom || currentRoom || '');
            if (!denyTargetRoom) break;

            // Only the doctor can deny patients
            if (authenticatedUserId !== denyTargetRoom.doctorUserId) {
              ws.send(JSON.stringify({ type: 'error', message: 'Only the doctor can deny patients' }));
              break;
            }

            const deniedEntry = denyTargetRoom.waitingPatients.get(denyId);
            if (!deniedEntry) break;

            denyTargetRoom.waitingPatients.delete(denyId);
            log(`Patient ${denyId} denied entry to room ${denyRoom || currentRoom}`);

            if (deniedEntry.ws.readyState === WebSocket.OPEN) {
              deniedEntry.ws.send(JSON.stringify({ type: 'patient-denied' }));
            }
            break;
          }

          case 'leave': {
            if (currentRoom && participantId) {
              const room = signalingRooms.get(currentRoom);
              if (room) {
                room.participants.delete(participantId);
                room.waitingPatients.delete(participantId);

                // Notify doctor if a waiting patient left
                if (room.doctorUserId && room.participants.has(room.doctorUserId)) {
                  const doctorWs = room.participants.get(room.doctorUserId);
                  if (doctorWs && doctorWs.readyState === WebSocket.OPEN) {
                    doctorWs.send(JSON.stringify({
                      type: 'patient-left-waiting',
                      patientId: participantId
                    }));
                  }
                }

                room.participants.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                      type: 'user-left',
                      odientId: participantId
                    }));
                  }
                });
                if (room.participants.size === 0 && room.waitingPatients.size === 0) {
                  signalingRooms.delete(currentRoom);
                }
              }
            }
            break;
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (currentRoom && participantId) {
        const room = signalingRooms.get(currentRoom);
        if (room) {
          const wasDoctorDisconnect = room.doctorUserId === participantId;

          room.participants.delete(participantId);
          room.waitingPatients.delete(participantId);
          log(`User ${participantId} left room ${currentRoom}. Remaining: ${room.participants.size}`);
          
          if (wasDoctorDisconnect) {
            room.waitingPatients.forEach((entry, wId) => {
              if (entry.ws.readyState === WebSocket.OPEN) {
                entry.ws.send(JSON.stringify({
                  type: 'doctor-disconnected'
                }));
              }
            });
            room.participants.forEach((client, pId) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: 'doctor-disconnected'
                }));
              }
            });
            room.doctorUserId = undefined;
          } else {
            // Patient disconnected: notify doctor
            if (room.doctorUserId && room.participants.has(room.doctorUserId)) {
              const doctorWs = room.participants.get(room.doctorUserId);
              if (doctorWs && doctorWs.readyState === WebSocket.OPEN) {
                doctorWs.send(JSON.stringify({
                  type: 'patient-left-waiting',
                  patientId: participantId
                }));
              }
            }
          }

          room.participants.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'user-left',
                odientId: participantId
              }));
            }
          });

          if (room.participants.size === 0 && room.waitingPatients.size === 0) {
            signalingRooms.delete(currentRoom);
          }
        }
      }
    });
  });

  log('WebRTC signaling server initialized on /ws');

  // Catch-all 404 for unmatched /api/* paths so unknown API calls don't fall through to the SPA HTML.
  app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl });
  });

  return httpServer;
}
