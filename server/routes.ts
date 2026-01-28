import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { transcribeAudio, generatePrescriptionFromTranscript } from "./openai";
import {
  insertPatientSchema,
  insertAppointmentSchema,
  insertClinicalRecordSchema,
  insertPrescriptionSchema,
  insertMedicalInstructionSchema,
  insertDoctorSchema,
} from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup Replit Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Ensure patient profile exists
      let patient = await storage.getPatientByUserId(userId);
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }
      
      res.json({ user, patient });
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      
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

  // Patient routes
  app.get("/api/patients/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      // Validate request body against partial patientSchema
      const validationResult = insertPatientSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const patientData = validationResult.data;
      const userId = req.user.claims.sub;
      let patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }
      
      const updated = await storage.updatePatient(patient.id, patientData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating patient profile:", error);
      res.status(500).json({ error: "Failed to update patient profile" });
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      let patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        patient = await storage.createPatient({ userId });
      }
      
      // Validate request body (patientId comes from authenticated user, not request)
      const bookingSchema = insertAppointmentSchema.omit({ patientId: true });
      const validationResult = bookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validationResult.error.flatten(),
        });
      }
      
      const appointmentData = validationResult.data;
      
      const appointment = await storage.createAppointment({
        patientId: patient.id,
        ...appointmentData,
        status: "confirmed",
        paymentStatus: "paid",
      });
      
      res.json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ error: "Failed to create appointment" });
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

  // Payment routes
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe publishable key:", error);
      res.status(500).json({ error: "Failed to get Stripe key" });
    }
  });

  app.post("/api/appointments/:id/pay", isAuthenticated, async (req: any, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const appointment = await storage.getAppointment(appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      
      const doctor = await storage.getDoctor(appointment.doctorId);
      if (!doctor) {
        return res.status(404).json({ error: "Doctor not found" });
      }
      
      const stripe = await getUncachableStripeClient();
      const user = await storage.getUser(req.user.claims.sub);
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Consulta médica - ${doctor.specialty}`,
                description: `Consulta con Dr. ${appointment.doctorName}`,
              },
              unit_amount: doctor.consultationFee,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${req.protocol}://${req.get("host")}/appointments?payment=success`,
        cancel_url: `${req.protocol}://${req.get("host")}/appointments?payment=cancelled`,
        customer_email: user?.email || undefined,
        metadata: {
          appointmentId: appointmentId.toString(),
        },
      });
      
      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create payment session" });
    }
  });

  app.get("/api/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patient = await storage.getPatientByUserId(userId);
      
      if (!patient) {
        return res.json([]);
      }
      
      // Get appointments with payment info
      const appointments = await storage.getAppointmentsByPatient(patient.id);
      const payments = appointments
        .filter(a => a.stripePaymentIntentId || a.paymentStatus === "paid")
        .map(a => ({
          id: a.stripePaymentIntentId || `appt-${a.id}`,
          amount: 5000, // Default consultation fee
          currency: "usd",
          status: a.paymentStatus === "paid" ? "succeeded" : "pending",
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const record = await storage.getClinicalRecord(parseInt(req.params.id));
      if (!record) {
        return res.status(404).json({ error: "Record not found" });
      }
      res.json(record);
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const patient = await storage.getPatientByUserId(userId);
      const user = await storage.getUser(userId);
      
      // Get clinical record if exists
      const records = await storage.getClinicalRecordsByPatient(patient?.id || 0);
      const clinicalRecord = records.find((r: any) => r.appointmentId === appointmentId);
      
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
          userName: appointment.doctorName,
          userImage: appointment.doctorImage,
        },
        patient: {
          id: patient?.id,
          dateOfBirth: patient?.dateOfBirth,
          gender: patient?.gender,
          bloodType: patient?.bloodType,
          allergies: patient?.allergies,
          medicalHistory: patient?.medicalHistory,
          userName: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email,
          userImage: user?.profileImageUrl,
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
      
      // Update appointment status
      await storage.updateAppointment(appointmentId, { status: "completed" });
      
      // Create clinical record
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
      
      // Generate prescription from transcription if available
      if (transcription) {
        try {
          const prescriptionData = await generatePrescriptionFromTranscript(transcription);
          if (prescriptionData && prescriptionData.medications?.length > 0) {
            await storage.createPrescription({
              clinicalRecordId: record.id,
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              medications: prescriptionData.medications,
              instructions: prescriptionData.instructions,
              validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              status: "active",
            });
          }
        } catch (e) {
          console.error("Error generating prescription:", e);
        }
      }
      
      res.json({ success: true, recordId: record.id });
    } catch (error) {
      console.error("Error ending consultation:", error);
      res.status(500).json({ error: "Failed to end consultation" });
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

  return httpServer;
}
