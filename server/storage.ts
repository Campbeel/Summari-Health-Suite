import { db } from "./db";
import { 
  users, 
  doctors, 
  patients, 
  appointments, 
  clinicalRecords, 
  prescriptions, 
  medicalInstructions,
  type User, 
  type InsertUser,
  type Doctor,
  type InsertDoctor,
  type Patient,
  type InsertPatient,
  type Appointment,
  type InsertAppointment,
  type ClinicalRecord,
  type InsertClinicalRecord,
  type Prescription,
  type InsertPrescription,
  type MedicalInstruction,
  type InsertMedicalInstruction
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";

// Custom type definitions for joined queries
type DoctorWithUserInfo = {
  id: number;
  userId: string;
  specialty: string;
  bio: string | null;
  consultationFee: number;
  availability: { [day: string]: { start: string; end: string }[] } | null;
  isActive: boolean;
  userName: string;
  userImage: string | null | undefined;
};

type AppointmentWithDoctor = {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  stripePaymentIntentId: string | null;
  consultationType: string;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  doctorImage: string;
};

type AppointmentWithDoctorFull = {
  id: number;
  patientId: number;
  doctorId: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  stripePaymentIntentId: string | null;
  consultationType: string;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  doctorImage: string;
};

type ClinicalRecordWithDoctor = {
  id: number;
  patientId: number;
  doctorId: number;
  appointmentId: number | null;
  recordDate: Date;
  chiefComplaint: string | null;
  symptoms: string[] | null;
  diagnosis: string | null;
  physicalExamination: string | null;
  vitalSigns: { bloodPressure?: string; heartRate?: number; temperature?: number; weight?: number; height?: number } | null;
  notes: string | null;
  transcription: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
};

type ClinicalRecordSummary = {
  id: number;
  recordDate: Date;
  diagnosis: string | null;
  doctorName: string;
};

type ClinicalRecordWithPrescriptionFlag = {
  id: number;
  recordDate: Date;
  chiefComplaint: string | null;
  symptoms: string[] | null;
  diagnosis: string | null;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  hasPrescription: boolean;
};

type PrescriptionWithDoctor = {
  id: number;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  instructions: string | null;
  issuedAt: Date;
  validUntil: string | null;
  status: string;
  doctorName: string;
  doctorSpecialty: string | null;
};

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: Partial<User>): Promise<User>;

  // Doctors
  getDoctor(id: number): Promise<Doctor | undefined>;
  getDoctorByUserId(userId: string): Promise<Doctor | undefined>;
  getAllDoctors(): Promise<DoctorWithUserInfo[]>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;

  // Patients
  getPatient(id: number): Promise<Patient | undefined>;
  getPatientByUserId(userId: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient>;

  // Appointments
  getAppointment(id: number): Promise<AppointmentWithDoctorFull | undefined>;
  getAppointmentsByPatient(patientId: number): Promise<AppointmentWithDoctor[]>;
  getUpcomingAppointments(patientId: number): Promise<AppointmentWithDoctor[]>;
  getAppointmentsByDoctor(doctorId: number): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment>;

  // Clinical Records
  getClinicalRecord(id: number): Promise<ClinicalRecordWithDoctor | undefined>;
  getClinicalRecordsByPatient(patientId: number): Promise<ClinicalRecordWithPrescriptionFlag[]>;
  getRecentRecordsByPatient(patientId: number, limit?: number): Promise<ClinicalRecordSummary[]>;
  createClinicalRecord(record: InsertClinicalRecord): Promise<ClinicalRecord>;
  updateClinicalRecord(id: number, record: Partial<InsertClinicalRecord>): Promise<ClinicalRecord>;

  // Prescriptions
  getPrescription(id: number): Promise<PrescriptionWithDoctor | undefined>;
  getPrescriptionsByPatient(patientId: number): Promise<PrescriptionWithDoctor[]>;
  createPrescription(prescription: InsertPrescription): Promise<Prescription>;

  // Medical Instructions
  getMedicalInstruction(id: number): Promise<MedicalInstruction | undefined>;
  getInstructionsByPatient(patientId: number): Promise<MedicalInstruction[]>;
  createMedicalInstruction(instruction: InsertMedicalInstruction): Promise<MedicalInstruction>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: Partial<User>): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        username: userData.username || userData.email,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: userData.username || userData.email,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
        },
      })
      .returning();
    return user;
  }

  // Doctors
  async getDoctor(id: number): Promise<Doctor | undefined> {
    const [doctor] = await db.select().from(doctors).where(eq(doctors.id, id));
    return doctor;
  }

  async getDoctorByUserId(userId: string): Promise<Doctor | undefined> {
    const [doctor] = await db.select().from(doctors).where(eq(doctors.userId, userId));
    return doctor;
  }

  async getAllDoctors(): Promise<DoctorWithUserInfo[]> {
    const result = await db
      .select({
        id: doctors.id,
        userId: doctors.userId,
        specialty: doctors.specialty,
        bio: doctors.bio,
        consultationFee: doctors.consultationFee,
        availability: doctors.availability,
        isActive: doctors.isActive,
        userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`.as('userName'),
        userImage: users.profileImageUrl,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .where(eq(doctors.isActive, true));
    return result;
  }

  async createDoctor(doctor: InsertDoctor): Promise<Doctor> {
    const [created] = await db.insert(doctors).values(doctor).returning();
    return created;
  }

  // Patients
  async getPatient(id: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async getPatientByUserId(userId: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.userId, userId));
    return patient;
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const [created] = await db.insert(patients).values(patient).returning();
    return created;
  }

  async updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient> {
    const [updated] = await db.update(patients).set(patient).where(eq(patients.id, id)).returning();
    return updated;
  }

  // Appointments
  async getAppointment(id: number): Promise<AppointmentWithDoctorFull | undefined> {
    const result = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        doctorId: appointments.doctorId,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        paymentStatus: appointments.paymentStatus,
        stripePaymentIntentId: appointments.stripePaymentIntentId,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        doctorImage: sql<string>`u.profile_image_url`.as('doctorImage'),
      })
      .from(appointments)
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(appointments.id, id));
    return result[0];
  }

  async getAppointmentsByPatient(patientId: number): Promise<AppointmentWithDoctor[]> {
    const result = await db
      .select({
        id: appointments.id,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        paymentStatus: appointments.paymentStatus,
        stripePaymentIntentId: appointments.stripePaymentIntentId,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        doctorImage: sql<string>`u.profile_image_url`.as('doctorImage'),
      })
      .from(appointments)
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(appointments.patientId, patientId))
      .orderBy(desc(appointments.scheduledDate));
    return result;
  }

  async getUpcomingAppointments(patientId: number): Promise<AppointmentWithDoctor[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db
      .select({
        id: appointments.id,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        paymentStatus: appointments.paymentStatus,
        stripePaymentIntentId: appointments.stripePaymentIntentId,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        doctorImage: sql<string>`u.profile_image_url`.as('doctorImage'),
      })
      .from(appointments)
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(
        and(
          eq(appointments.patientId, patientId),
          gte(appointments.scheduledDate, today),
          sql`${appointments.status} NOT IN ('completed', 'cancelled')`
        )
      )
      .orderBy(appointments.scheduledDate, appointments.scheduledTime);
    return result;
  }

  async getAppointmentsByDoctor(doctorId: number): Promise<Appointment[]> {
    const result = await db
      .select()
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId))
      .orderBy(desc(appointments.scheduledDate));
    return result;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [created] = await db.insert(appointments).values(appointment).returning();
    return created;
  }

  async updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment> {
    const [updated] = await db
      .update(appointments)
      .set({ ...appointment, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return updated;
  }

  // Clinical Records
  async getClinicalRecord(id: number): Promise<ClinicalRecordWithDoctor | undefined> {
    const result = await db
      .select({
        id: clinicalRecords.id,
        patientId: clinicalRecords.patientId,
        doctorId: clinicalRecords.doctorId,
        appointmentId: clinicalRecords.appointmentId,
        recordDate: clinicalRecords.recordDate,
        chiefComplaint: clinicalRecords.chiefComplaint,
        symptoms: clinicalRecords.symptoms,
        diagnosis: clinicalRecords.diagnosis,
        physicalExamination: clinicalRecords.physicalExamination,
        vitalSigns: clinicalRecords.vitalSigns,
        notes: clinicalRecords.notes,
        transcription: clinicalRecords.transcription,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
      })
      .from(clinicalRecords)
      .leftJoin(doctors, eq(clinicalRecords.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(clinicalRecords.id, id));
    return result[0];
  }

  async getClinicalRecordsByPatient(patientId: number): Promise<ClinicalRecordWithPrescriptionFlag[]> {
    const result = await db
      .select({
        id: clinicalRecords.id,
        recordDate: clinicalRecords.recordDate,
        chiefComplaint: clinicalRecords.chiefComplaint,
        symptoms: clinicalRecords.symptoms,
        diagnosis: clinicalRecords.diagnosis,
        notes: clinicalRecords.notes,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        hasPrescription: sql<boolean>`EXISTS(SELECT 1 FROM prescriptions p WHERE p.clinical_record_id = ${clinicalRecords.id})`.as('hasPrescription'),
      })
      .from(clinicalRecords)
      .leftJoin(doctors, eq(clinicalRecords.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(clinicalRecords.patientId, patientId))
      .orderBy(desc(clinicalRecords.recordDate));
    return result;
  }

  async getRecentRecordsByPatient(patientId: number, limit = 5): Promise<ClinicalRecordSummary[]> {
    const result = await db
      .select({
        id: clinicalRecords.id,
        recordDate: clinicalRecords.recordDate,
        diagnosis: clinicalRecords.diagnosis,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
      })
      .from(clinicalRecords)
      .leftJoin(doctors, eq(clinicalRecords.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(clinicalRecords.patientId, patientId))
      .orderBy(desc(clinicalRecords.recordDate))
      .limit(limit);
    return result;
  }

  async createClinicalRecord(record: InsertClinicalRecord): Promise<ClinicalRecord> {
    const [created] = await db.insert(clinicalRecords).values(record).returning();
    return created;
  }

  async updateClinicalRecord(id: number, record: Partial<InsertClinicalRecord>): Promise<ClinicalRecord> {
    const [updated] = await db
      .update(clinicalRecords)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(clinicalRecords.id, id))
      .returning();
    return updated;
  }

  // Prescriptions
  async getPrescription(id: number): Promise<PrescriptionWithDoctor | undefined> {
    const result = await db
      .select({
        id: prescriptions.id,
        medications: prescriptions.medications,
        instructions: prescriptions.instructions,
        issuedAt: prescriptions.issuedAt,
        validUntil: prescriptions.validUntil,
        status: prescriptions.status,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
      })
      .from(prescriptions)
      .leftJoin(doctors, eq(prescriptions.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(prescriptions.id, id));
    return result[0];
  }

  async getPrescriptionsByPatient(patientId: number): Promise<PrescriptionWithDoctor[]> {
    const result = await db
      .select({
        id: prescriptions.id,
        medications: prescriptions.medications,
        instructions: prescriptions.instructions,
        issuedAt: prescriptions.issuedAt,
        validUntil: prescriptions.validUntil,
        status: prescriptions.status,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
      })
      .from(prescriptions)
      .leftJoin(doctors, eq(prescriptions.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(prescriptions.patientId, patientId))
      .orderBy(desc(prescriptions.issuedAt));
    return result;
  }

  async createPrescription(prescription: InsertPrescription): Promise<Prescription> {
    const [created] = await db.insert(prescriptions).values(prescription).returning();
    return created;
  }

  // Medical Instructions
  async getMedicalInstruction(id: number): Promise<MedicalInstruction | undefined> {
    const [instruction] = await db.select().from(medicalInstructions).where(eq(medicalInstructions.id, id));
    return instruction;
  }

  async getInstructionsByPatient(patientId: number): Promise<MedicalInstruction[]> {
    const result = await db
      .select()
      .from(medicalInstructions)
      .where(eq(medicalInstructions.patientId, patientId))
      .orderBy(desc(medicalInstructions.createdAt));
    return result;
  }

  async createMedicalInstruction(instruction: InsertMedicalInstruction): Promise<MedicalInstruction> {
    const [created] = await db.insert(medicalInstructions).values(instruction).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
