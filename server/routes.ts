import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { storage } from "./storage";
import { isAuthenticated, registerAuthRoutes } from "./auth";
import { createPayment, getPaymentStatus, isPaymentSuccessful, getPaymentStatusText, verifyFlowSignature } from "./flow";
import { transcribeAudio, generatePrescriptionFromTranscript, generateFullConsultationSuggestions } from "./openai";
import {
  insertPatientSchema,
  insertAppointmentSchema,
  insertClinicalRecordSchema,
  insertPrescriptionSchema,
  insertMedicalInstructionSchema,
  insertDoctorSchema,
} from "@shared/schema";

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
      
      // Ensure patient profile exists
      let patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }
      
      const { passwordHash, ...safeUser } = user || {};
      res.json({ user: safeUser, patient });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Doctors routes
  app.get("/api/doctors", async (req, res) => {
    try {
      const doctors = await storage.getAllDoctors();
      res.json(doctors);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      res.status(500).json({ error: "Failed to fetch doctors" });
    }
  });

  // Doctor (current user) routes - must be before :id routes to prevent "me" being matched as an id
  app.get("/api/doctors/me", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/doctors/me/stats", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/doctors/me/appointments", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/doctors/me/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const doctor = await storage.getDoctorByUserId(userId);
      
      if (!doctor) {
        return res.status(403).json({ error: "User is not a doctor" });
      }
      
      const allowedFields = insertDoctorSchema.pick({ bio: true, consultationFee: true }).partial();
      const validationResult = allowedFields.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const updated = await storage.updateDoctorProfile(doctor.id, validationResult.data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating doctor profile:", error);
      res.status(500).json({ error: "Failed to update doctor profile" });
    }
  });

  app.patch("/api/doctors/me/availability", isAuthenticated, async (req: any, res) => {
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

  app.patch("/api/appointments/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const userId = req.userId;
      
      const statusSchema = z.object({
        status: z.enum(["confirmed", "cancelled", "in_progress", "completed"]),
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
      
      const updated = await storage.updateAppointmentStatus(appointmentId, validationResult.data.status);
      res.json(updated);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ error: "Failed to update appointment status" });
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
      const appointmentId = parseInt(req.params.id);
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
      res.status(500).json({ error: "Error al crear la sesión de pago" });
    }
  });

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
      
      await storage.updateAppointment(appointment.id, {
        paymentStatus: status,
        status: isPaymentSuccessful(paymentStatus.status) ? "confirmed" : appointment.status,
      });
      
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
      const appointmentId = parseInt(req.params.id);
      const appointment = await storage.getAppointment(appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ error: "Consultation not found" });
      }
      
      const doctor = await storage.getDoctor(appointment.doctorId);
      const doctorUser = doctor ? await storage.getUser(doctor.userId) : null;
      const appointmentPatient = await storage.getPatient(appointment.patientId);
      const patientUser = appointmentPatient ? await storage.getUser(appointmentPatient.userId) : null;
      
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

  app.post("/api/consultations/:id/end", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const { transcription, notes, diagnosis, symptoms } = req.body;
      
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ error: "Consultation not found" });
      }
      
      await storage.updateAppointment(appointmentId, { status: "pending_validation" });
      
      const record = await storage.createClinicalRecord({
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        appointmentId,
        chiefComplaint: appointment.notes,
        symptoms: symptoms || [],
        diagnosis,
        notes,
        transcription,
      });
      
      let aiSuggestions = null;
      if (transcription) {
        try {
          aiSuggestions = await generateFullConsultationSuggestions(transcription);
        } catch (e) {
          console.error("Error generating AI suggestions:", e);
        }
      }
      
      res.json({ success: true, recordId: record.id, appointmentId, aiSuggestions });
    } catch (error) {
      console.error("Error ending consultation:", error);
      res.status(500).json({ error: "Failed to end consultation" });
    }
  });

  app.get("/api/consultations/:id/validation", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
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
          dateOfBirth: patient?.dateOfBirth,
          gender: patient?.gender,
          bloodType: patient?.bloodType,
          allergies: patient?.allergies,
        },
        clinicalRecord: {
          id: clinicalRecord.id,
          chiefComplaint: clinicalRecord.chiefComplaint,
          symptoms: clinicalRecord.symptoms,
          diagnosis: clinicalRecord.diagnosis,
          notes: clinicalRecord.notes,
          transcription: clinicalRecord.transcription,
        },
        prescription: existingPrescription || null,
        medicalInstructions: existingInstructions || [],
      });
    } catch (error) {
      console.error("Error fetching validation data:", error);
      res.status(500).json({ error: "Error al obtener datos de validación" });
    }
  });

  app.post("/api/consultations/:id/validate", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const userId = req.userId;
      const { clinicalRecord: clinicalData, prescription: prescriptionData, medicalInstructions: instructionsData } = req.body;

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

      const clinicalSchema = z.object({
        chiefComplaint: z.string().optional().nullable(),
        symptoms: z.array(z.string()).optional(),
        diagnosis: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      });

      const medicationSchema = z.object({
        name: z.string().min(1, "Nombre del medicamento requerido"),
        dosage: z.string().min(1, "Dosis requerida"),
        frequency: z.string().min(1, "Frecuencia requerida"),
        duration: z.string().min(1, "Duración requerida"),
        instructions: z.string().optional(),
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
        await storage.updateClinicalRecord(existingRecord.id, {
          chiefComplaint: parsed.data.chiefComplaint || null,
          symptoms: parsed.data.symptoms || [],
          diagnosis: parsed.data.diagnosis || null,
          notes: parsed.data.notes || null,
        });
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

      await storage.updateAppointment(appointmentId, { status: "completed" });

      res.json({ success: true });
    } catch (error) {
      console.error("Error validating consultation:", error);
      res.status(500).json({ error: "Error al validar la consulta" });
    }
  });

  app.post("/api/consultations/:id/generate-suggestions", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
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

  app.post("/api/consultations/:id/transcribe", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      
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

  // Admin routes
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithDoctorStatus = await Promise.all(
        allUsers.map(async (user) => {
          const doctor = await storage.getDoctorByUserId(user.id);
          const { passwordHash, ...safeUser } = user;
          return {
            ...safeUser,
            isDoctor: !!doctor,
            doctorId: doctor?.id || null,
            specialty: doctor?.specialty || null,
          };
        })
      );
      res.json(usersWithDoctorStatus);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/promote-to-doctor", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const promoteSchema = z.object({
        userId: z.string(),
        specialty: z.string().min(1, "Specialty is required"),
        licenseNumber: z.string().min(1, "License number is required"),
        bio: z.string().optional(),
        consultationFee: z.number().min(0).default(25000),
      });
      
      const validationResult = promoteSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const { userId, specialty, licenseNumber, bio, consultationFee } = validationResult.data;
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Check if already a doctor
      const existingDoctor = await storage.getDoctorByUserId(userId);
      if (existingDoctor) {
        return res.status(400).json({ error: "User is already a doctor" });
      }
      
      // Create doctor profile
      const doctor = await storage.createDoctor({
        userId,
        specialty,
        licenseNumber,
        bio: bio || null,
        consultationFee,
      });
      
      res.json({ success: true, doctor });
    } catch (error) {
      console.error("Error promoting user to doctor:", error);
      res.status(500).json({ error: "Failed to promote user to doctor" });
    }
  });

  app.get("/api/admin/check", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.userId;
      const user = await storage.getUser(userId);
      res.json({ isAdmin: !!user?.isAdmin });
    } catch (error) {
      res.status(500).json({ error: "Failed to check admin status" });
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
            // Doctor disconnected: notify all waiting patients
            room.waitingPatients.forEach((entry, wId) => {
              if (entry.ws.readyState === WebSocket.OPEN) {
                entry.ws.send(JSON.stringify({
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

  return httpServer;
}
