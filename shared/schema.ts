import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, serial, date, time } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";
export * from "./models/chat";

// Doctors table
export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  specialty: text("specialty").notNull(),
  licenseNumber: text("license_number").notNull(),
  bio: text("bio"),
  consultationFee: integer("consultation_fee").notNull().default(25000), // in CLP (Chilean Pesos)
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
  transcription: text("transcription"),
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
  status: text("status").notNull().default("active"), // active, dispensed, expired, cancelled
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

// Insert schemas
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

// Types
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
