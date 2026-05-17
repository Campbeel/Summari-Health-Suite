import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, serial, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";
export * from "./models/chat";

// Organizations table
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  rut: text("rut"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

// Doctors table
export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  // Optional: doctors can be independent (NULL) or org-affiliated
  organizationId: varchar("organization_id"),
  specialty: text("specialty").notNull(),
  licenseNumber: text("license_number").notNull(),
  bio: text("bio"),
  consultationFee: integer("consultation_fee").notNull().default(25000), // in CLP (Chilean Pesos)
  consultationDuration: integer("consultation_duration").notNull().default(30), // in minutes
  availability: jsonb("availability").$type<{ [day: string]: { start: string; end: string }[] }>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Patients table (extends users)
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  rut: text("rut"),
  email: text("email"),
  whatsapp: text("whatsapp"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  bloodType: text("blood_type"),
  allergies: text("allergies").array(),
  medicalHistory: text("medical_history"),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  // Pregnancy / lactation status drive bloqueant alerts in the prescription flow.
  // Editable by the patient from their profile; visible to the doctor.
  isPregnant: boolean("is_pregnant").notNull().default(false),
  isBreastfeeding: boolean("is_breastfeeding").notNull().default(false),
  historySummary: text("history_summary"),
  historySummaryAt: timestamp("history_summary_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Appointments table
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: time("scheduled_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, in_progress, completed, cancelled
  paymentStatus: text("payment_status").notNull().default("pending"), // pending, paid, rejected, cancelled
  flowToken: text("flow_token"),
  flowCommerceOrderId: text("flow_commerce_order_id"),
  consultationType: text("consultation_type").notNull().default("video"), // video, audio
  notes: text("notes"),
  // Reason given by whoever cancels the appointment. Required on the doctor-facing cancel flow.
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clinical Records table
export const clinicalRecords = pgTable("clinical_records", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  appointmentId: integer("appointment_id").references(() => appointments.id),
  recordDate: timestamp("record_date").defaultNow().notNull(),
  chiefComplaint: text("chief_complaint"),
  symptoms: text("symptoms").array(),
  diagnosis: text("diagnosis"),
  physicalExamination: text("physical_examination"),
  vitalSigns: jsonb("vital_signs").$type<{
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
  }>(),
  notes: text("notes"),
  gesDiagnosis: jsonb("ges_diagnosis").$type<GesDiagnosis[]>(),
  transcription: text("transcription"),
  medicalReport: jsonb("medical_report").$type<{
    patientData: {
      fullName: string;
      age: number | null;
      sex: string;
      maritalStatus: string;
      occupation: string;
      location: string;
    };
    consultationData: {
      reason: string;
      currentIllness: {
        description: string;
        onset: string;
        duration: string;
        associatedSymptoms: string;
        modifyingFactors: string;
        previousTreatments: string;
      };
    };
    medicalHistory: {
      medical: string;
      surgical: string;
      allergies: string;
      medications: string;
      toxicological: string;
      gynecological: string | null;
      socioeconomic: string;
      pets: string;
    };
    familyHistory: string;
    habits: {
      diet: string;
      physicalActivity: string;
      sleep: string;
      substanceUse: string;
    };
    systemsReview: string;
    physicalExam: {
      systemsExploration: string;
    };
    diagnosticImpression: string;
    treatmentPlan: {
      tests: string[];
      treatment: string;
      instructions: string[];
    };
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prescriptions table
export const prescriptions = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  clinicalRecordId: integer("clinical_record_id").notNull().references(() => clinicalRecords.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  medications: jsonb("medications").$type<Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>>().notNull(),
  instructions: text("instructions"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  validUntil: date("valid_until"),
  status: text("status").notNull().default("active"), // draft, pending_signature, signed, sent, active, dispensed, expired, cancelled
  signedPdfData: text("signed_pdf_data"),
  signedAt: timestamp("signed_at"),
});

// Medical Instructions table
export const medicalInstructions = pgTable("medical_instructions", {
  id: serial("id").primaryKey(),
  clinicalRecordId: integer("clinical_record_id").notNull().references(() => clinicalRecords.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  category: text("category").notNull(), // diet, exercise, lifestyle, follow-up, tests
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  dueDate: date("due_date"),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").notNull().default("active"), // draft, pending_signature, signed, sent, active
  signedPdfData: text("signed_pdf_data"),
  signedAt: timestamp("signed_at"),
});

// Exam Orders table
export const examOrders = pgTable("exam_orders", {
  id: serial("id").primaryKey(),
  clinicalRecordId: integer("clinical_record_id").notNull().references(() => clinicalRecords.id),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  exams: jsonb("exams").$type<Array<{
    name: string;
    instructions?: string;
  }>>().notNull(),
  clinicalJustification: text("clinical_justification"),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  status: text("status").notNull().default("pending"), // draft, pending_signature, signed, sent, pending, completed, cancelled
  signedPdfData: text("signed_pdf_data"),
  signedAt: timestamp("signed_at"),
});

// Wearable Health Metrics table
export const wearableMetrics = pgTable("wearable_metrics", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  metricType: text("metric_type").notNull(), // heart_rate, steps, sleep_duration, sleep_quality, spo2, bp_systolic, bp_diastolic, weight, temperature, calories
  value: text("value").notNull(),
  unit: text("unit").notNull(), // bpm, steps, hours, %, mmHg, kg, °C, kcal
  source: text("source").notNull().default("manual"), // manual, apple_health, google_fit, fitbit, garmin, samsung, whoop, oura, csv_import
  deviceName: text("device_name"),
  recordedAt: timestamp("recorded_at").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Wearable Connections (OAuth tokens for Fitbit, etc.)
export const wearableConnections = pgTable("wearable_connections", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull().references(() => patients.id),
  provider: text("provider").notNull(), // fitbit, garmin, etc.
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  providerUserId: text("provider_user_id"),
  scopes: text("scopes"),
  lastSyncAt: timestamp("last_sync_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const doctorsRelations = relations(doctors, ({ many }) => ({
  appointments: many(appointments),
  clinicalRecords: many(clinicalRecords),
  prescriptions: many(prescriptions),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  clinicalRecords: many(clinicalRecords),
  prescriptions: many(prescriptions),
  wearableMetrics: many(wearableMetrics),
  wearableConnections: many(wearableConnections),
}));

export const wearableConnectionsRelations = relations(wearableConnections, ({ one }) => ({
  patient: one(patients, {
    fields: [wearableConnections.patientId],
    references: [patients.id],
  }),
}));

export const wearableMetricsRelations = relations(wearableMetrics, ({ one }) => ({
  patient: one(patients, {
    fields: [wearableMetrics.patientId],
    references: [patients.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [appointments.doctorId],
    references: [doctors.id],
  }),
}));

export const clinicalRecordsRelations = relations(clinicalRecords, ({ one, many }) => ({
  patient: one(patients, {
    fields: [clinicalRecords.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [clinicalRecords.doctorId],
    references: [doctors.id],
  }),
  appointment: one(appointments, {
    fields: [clinicalRecords.appointmentId],
    references: [appointments.id],
  }),
  prescriptions: many(prescriptions),
  instructions: many(medicalInstructions),
  examOrders: many(examOrders),
}));

export const examOrdersRelations = relations(examOrders, ({ one }) => ({
  clinicalRecord: one(clinicalRecords, {
    fields: [examOrders.clinicalRecordId],
    references: [clinicalRecords.id],
  }),
  patient: one(patients, {
    fields: [examOrders.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [examOrders.doctorId],
    references: [doctors.id],
  }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one }) => ({
  clinicalRecord: one(clinicalRecords, {
    fields: [prescriptions.clinicalRecordId],
    references: [clinicalRecords.id],
  }),
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [prescriptions.doctorId],
    references: [doctors.id],
  }),
}));

export const medicalInstructionsRelations = relations(medicalInstructions, ({ one }) => ({
  clinicalRecord: one(clinicalRecords, {
    fields: [medicalInstructions.clinicalRecordId],
    references: [clinicalRecords.id],
  }),
  patient: one(patients, {
    fields: [medicalInstructions.patientId],
    references: [patients.id],
  }),
  doctor: one(doctors, {
    fields: [medicalInstructions.doctorId],
    references: [doctors.id],
  }),
}));

// Consultation Chat Messages
export const consultationMessages = pgTable("consultation_messages", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").notNull().references(() => appointments.id),
  senderUserId: varchar("sender_user_id").notNull(),
  senderRole: text("sender_role").notNull(), // 'doctor' | 'patient'
  content: text("content"),
  fileName: text("file_name"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertConsultationMessageSchema = createInsertSchema(consultationMessages).omit({
  id: true,
  createdAt: true,
});

export const insertDoctorSchema = createInsertSchema(doctors).omit({
  id: true,
  createdAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClinicalRecordSchema = createInsertSchema(clinicalRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPrescriptionSchema = createInsertSchema(prescriptions).omit({
  id: true,
  issuedAt: true,
});

export const insertMedicalInstructionSchema = createInsertSchema(medicalInstructions).omit({
  id: true,
  createdAt: true,
});

export const insertWearableMetricSchema = createInsertSchema(wearableMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertWearableConnectionSchema = createInsertSchema(wearableConnections).omit({
  id: true,
  createdAt: true,
});

export const insertExamOrderSchema = createInsertSchema(examOrders).omit({
  id: true,
  issuedAt: true,
});

// Reimbursement Requests
export const reimbursementRequests = pgTable("reimbursement_requests", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  amount: integer("amount").notNull(),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReimbursementRequestSchema = createInsertSchema(reimbursementRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ReimbursementRequest = typeof reimbursementRequests.$inferSelect;
export type InsertReimbursementRequest = z.infer<typeof insertReimbursementRequestSchema>;

// Consultation Ratings
export const consultationRatings = pgTable("consultation_ratings", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id").references(() => appointments.id).notNull().unique(),
  patientUserId: varchar("patient_user_id").notNull(),
  doctorRating: integer("doctor_rating").notNull(),
  doctorComment: text("doctor_comment"),
  platformRating: integer("platform_rating"),
  platformComment: text("platform_comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConsultationRatingSchema = createInsertSchema(consultationRatings).omit({
  id: true,
  createdAt: true,
});

// GES (Garantías Explícitas en Salud) table - read-only reference data
export const ges = pgTable("ges", {
  idProblema: integer("id_problema"),
  problemaDeSalud: text("problema_de_salud"),
  codigoCie10: text("código_cie-10"),
  descriptor: text("descriptor"),
});

export type GesEntry = typeof ges.$inferSelect;

export interface GesDiagnosis {
  idProblema: number;
  problemaDeSalud: string;
  codigoCie10: string;
  descriptor: string;
}

// Types
export type ConsultationRating = typeof consultationRatings.$inferSelect;
export type InsertConsultationRating = z.infer<typeof insertConsultationRatingSchema>;
export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type ClinicalRecord = typeof clinicalRecords.$inferSelect;
export type InsertClinicalRecord = z.infer<typeof insertClinicalRecordSchema>;
export type Prescription = typeof prescriptions.$inferSelect;
export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;
export type MedicalInstruction = typeof medicalInstructions.$inferSelect;
export type InsertMedicalInstruction = z.infer<typeof insertMedicalInstructionSchema>;
export type WearableMetric = typeof wearableMetrics.$inferSelect;
export type InsertWearableMetric = z.infer<typeof insertWearableMetricSchema>;
export type WearableConnection = typeof wearableConnections.$inferSelect;
export type InsertWearableConnection = z.infer<typeof insertWearableConnectionSchema>;
export type ExamOrder = typeof examOrders.$inferSelect;
export type InsertExamOrder = z.infer<typeof insertExamOrderSchema>;
export type ConsultationMessage = typeof consultationMessages.$inferSelect;
export type InsertConsultationMessage = z.infer<typeof insertConsultationMessageSchema>;

export const reportTemplates = pgTable("report_templates", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctors.id),
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
