import { db } from "./db";
import { 
  users, 
  doctors, 
  patients, 
  appointments, 
  clinicalRecords, 
  prescriptions, 
  medicalInstructions,
  wearableMetrics,
  type User, 
  type UpsertUser,
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
  type InsertMedicalInstruction,
  type WearableMetric,
  type InsertWearableMetric
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, notInArray } from "drizzle-orm";

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
  flowToken: string | null;
  flowCommerceOrderId: string | null;
  consultationType: string;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  doctorImage: string;
  consultationFee: number;
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
  flowToken: string | null;
  flowCommerceOrderId: string | null;
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

type DoctorDashboardStats = {
  todayAppointments: number;
  upcomingAppointments: number;
  completedConsultations: number;
};

type AppointmentWithPatient = {
  id: number;
  patientId: number;
  doctorId: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  flowToken: string | null;
  consultationType: string;
  notes: string | null;
  patientName: string;
  patientImage: string | null;
  patientDateOfBirth: string | null;
  patientGender: string | null;
  patientBloodType: string | null;
};

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: Partial<User>): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Doctors
  getDoctor(id: number): Promise<Doctor | undefined>;
  getDoctorByUserId(userId: string): Promise<Doctor | undefined>;
  getAllDoctors(): Promise<DoctorWithUserInfo[]>;
  createDoctor(doctor: InsertDoctor): Promise<Doctor>;
  getDoctorDashboardStats(doctorId: number): Promise<DoctorDashboardStats>;
  updateDoctorProfile(doctorId: number, data: Partial<InsertDoctor>): Promise<Doctor>;

  // Patients
  getPatient(id: number): Promise<Patient | undefined>;
  getPatientByUserId(userId: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient>;

  // Appointments
  getAppointment(id: number): Promise<AppointmentWithDoctorFull | undefined>;
  getAppointmentByCommerceOrderId(commerceOrderId: string): Promise<Appointment | undefined>;
  getAppointmentByFlowToken(flowToken: string): Promise<Appointment | undefined>;
  getAppointmentsByPatient(patientId: number): Promise<AppointmentWithDoctor[]>;
  getUpcomingAppointments(patientId: number): Promise<AppointmentWithDoctor[]>;
  getAppointmentsByDoctor(doctorId: number): Promise<Appointment[]>;
  getAppointmentsByDoctorWithPatient(doctorId: number): Promise<AppointmentWithPatient[]>;
  getUpcomingAppointmentsByDoctor(doctorId: number): Promise<AppointmentWithPatient[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment>;

  // Clinical Records
  getClinicalRecord(id: number): Promise<ClinicalRecordWithDoctor | undefined>;
  getClinicalRecordByAppointmentId(appointmentId: number): Promise<ClinicalRecord | undefined>;
  getClinicalRecordsByPatient(patientId: number): Promise<ClinicalRecordWithPrescriptionFlag[]>;
  getRecentRecordsByPatient(patientId: number, limit?: number): Promise<ClinicalRecordSummary[]>;
  createClinicalRecord(record: InsertClinicalRecord): Promise<ClinicalRecord>;
  updateClinicalRecord(id: number, record: Partial<InsertClinicalRecord>): Promise<ClinicalRecord>;

  // Prescriptions
  getPrescription(id: number): Promise<PrescriptionWithDoctor | undefined>;
  getPrescriptionByRecordId(clinicalRecordId: number): Promise<PrescriptionWithDoctor | undefined>;
  getPrescriptionsByPatient(patientId: number): Promise<PrescriptionWithDoctor[]>;
  createPrescription(prescription: InsertPrescription): Promise<Prescription>;

  // Prescriptions (update)
  updatePrescription(id: number, data: Partial<InsertPrescription>): Promise<Prescription>;

  // Medical Instructions
  getMedicalInstruction(id: number): Promise<MedicalInstruction | undefined>;
  getInstructionsByPatient(patientId: number): Promise<MedicalInstruction[]>;
  getInstructionsByRecordId(clinicalRecordId: number): Promise<MedicalInstruction[]>;
  deleteInstructionsByRecordId(clinicalRecordId: number): Promise<void>;
  createMedicalInstruction(instruction: InsertMedicalInstruction): Promise<MedicalInstruction>;

  // Wearable Metrics
  createWearableMetric(metric: InsertWearableMetric): Promise<WearableMetric>;
  createWearableMetrics(metrics: InsertWearableMetric[]): Promise<WearableMetric[]>;
  getWearableMetrics(patientId: number, filters?: { metricType?: string; from?: string; to?: string; source?: string }): Promise<WearableMetric[]>;
  getWearableMetricsSummary(patientId: number, from?: string, to?: string): Promise<{ metricType: string; avg: number; min: number; max: number; count: number; latestValue: string; unit: string }[]>;
  getLatestWearableMetrics(patientId: number): Promise<WearableMetric[]>;
  deleteWearableMetric(id: number, patientId: number): Promise<void>;
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
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

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
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

  async getDoctorDashboardStats(doctorId: number): Promise<DoctorDashboardStats> {
    const today = new Date().toISOString().split('T')[0];
    
    const [todayResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.scheduledDate, today)
        )
      );
    
    const [upcomingResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.scheduledDate, today),
          sql`${appointments.status} NOT IN ('completed', 'cancelled')`
        )
      );
    
    const [completedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.status, 'completed')
        )
      );
    
    return {
      todayAppointments: todayResult?.count || 0,
      upcomingAppointments: upcomingResult?.count || 0,
      completedConsultations: completedResult?.count || 0,
    };
  }

  async updateDoctorProfile(doctorId: number, data: Partial<InsertDoctor>): Promise<Doctor> {
    const [updated] = await db
      .update(doctors)
      .set(data)
      .where(eq(doctors.id, doctorId))
      .returning();
    return updated;
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
        flowToken: appointments.flowToken,
        flowCommerceOrderId: appointments.flowCommerceOrderId,
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

  async getAppointmentByCommerceOrderId(commerceOrderId: string): Promise<Appointment | undefined> {
    const [result] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.flowCommerceOrderId, commerceOrderId));
    return result;
  }

  async getAppointmentByFlowToken(flowToken: string): Promise<Appointment | undefined> {
    const [result] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.flowToken, flowToken));
    return result;
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
        flowToken: appointments.flowToken,
        flowCommerceOrderId: appointments.flowCommerceOrderId,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        doctorImage: sql<string>`u.profile_image_url`.as('doctorImage'),
        consultationFee: sql<number>`COALESCE(${doctors.consultationFee}, 25000)`.as('consultationFee'),
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
        flowToken: appointments.flowToken,
        flowCommerceOrderId: appointments.flowCommerceOrderId,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        doctorImage: sql<string>`u.profile_image_url`.as('doctorImage'),
        consultationFee: sql<number>`COALESCE(${doctors.consultationFee}, 25000)`.as('consultationFee'),
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

  async getAppointmentsByDoctorWithPatient(doctorId: number): Promise<AppointmentWithPatient[]> {
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
        flowToken: appointments.flowToken,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        patientName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('patientName'),
        patientImage: sql<string | null>`u.profile_image_url`.as('patientImage'),
        patientDateOfBirth: patients.dateOfBirth,
        patientGender: patients.gender,
        patientBloodType: patients.bloodType,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(sql`users u`, sql`${patients.userId} = u.id`)
      .where(eq(appointments.doctorId, doctorId))
      .orderBy(desc(appointments.scheduledDate), desc(appointments.scheduledTime));
    return result;
  }

  async getUpcomingAppointmentsByDoctor(doctorId: number): Promise<AppointmentWithPatient[]> {
    const today = new Date().toISOString().split('T')[0];
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
        flowToken: appointments.flowToken,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        patientName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('patientName'),
        patientImage: sql<string | null>`u.profile_image_url`.as('patientImage'),
        patientDateOfBirth: patients.dateOfBirth,
        patientGender: patients.gender,
        patientBloodType: patients.bloodType,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(sql`users u`, sql`${patients.userId} = u.id`)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          gte(appointments.scheduledDate, today),
          sql`${appointments.status} NOT IN ('completed', 'cancelled')`
        )
      )
      .orderBy(appointments.scheduledDate, appointments.scheduledTime);
    return result;
  }

  async getBookedSlots(doctorId: number, scheduledDate: string): Promise<string[]> {
    const results = await db
      .select({ time: appointments.scheduledTime })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.scheduledDate, scheduledDate),
          notInArray(appointments.status, ['cancelled'])
        )
      );
    return results.map(r => r.time);
  }

  async hasConflictingAppointment(doctorId: number, scheduledDate: string, scheduledTime: string): Promise<boolean> {
    const conflicts = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, doctorId),
          eq(appointments.scheduledDate, scheduledDate),
          eq(appointments.scheduledTime, scheduledTime),
          notInArray(appointments.status, ['cancelled'])
        )
      )
      .limit(1);
    return conflicts.length > 0;
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

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment> {
    const [updated] = await db
      .update(appointments)
      .set({ status, updatedAt: new Date() })
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

  async getClinicalRecordByAppointmentId(appointmentId: number): Promise<ClinicalRecord | undefined> {
    const [record] = await db
      .select()
      .from(clinicalRecords)
      .where(eq(clinicalRecords.appointmentId, appointmentId));
    return record;
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

  async getPrescriptionByRecordId(clinicalRecordId: number): Promise<PrescriptionWithDoctor | undefined> {
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
      .where(eq(prescriptions.clinicalRecordId, clinicalRecordId));
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

  async updatePrescription(id: number, data: Partial<InsertPrescription>): Promise<Prescription> {
    const [updated] = await db
      .update(prescriptions)
      .set(data)
      .where(eq(prescriptions.id, id))
      .returning();
    return updated;
  }

  async deleteInstructionsByRecordId(clinicalRecordId: number): Promise<void> {
    await db
      .delete(medicalInstructions)
      .where(eq(medicalInstructions.clinicalRecordId, clinicalRecordId));
  }

  async getInstructionsByRecordId(clinicalRecordId: number): Promise<MedicalInstruction[]> {
    const result = await db
      .select()
      .from(medicalInstructions)
      .where(eq(medicalInstructions.clinicalRecordId, clinicalRecordId))
      .orderBy(medicalInstructions.createdAt);
    return result;
  }

  async createMedicalInstruction(instruction: InsertMedicalInstruction): Promise<MedicalInstruction> {
    const [created] = await db.insert(medicalInstructions).values(instruction).returning();
    return created;
  }

  // Wearable Metrics
  async createWearableMetric(metric: InsertWearableMetric): Promise<WearableMetric> {
    const [created] = await db.insert(wearableMetrics).values(metric).returning();
    return created;
  }

  async createWearableMetrics(metrics: InsertWearableMetric[]): Promise<WearableMetric[]> {
    if (metrics.length === 0) return [];
    const created = await db.insert(wearableMetrics).values(metrics).returning();
    return created;
  }

  async getWearableMetrics(patientId: number, filters?: { metricType?: string; from?: string; to?: string; source?: string }): Promise<WearableMetric[]> {
    const conditions = [eq(wearableMetrics.patientId, patientId)];
    if (filters?.metricType) conditions.push(eq(wearableMetrics.metricType, filters.metricType));
    if (filters?.source) conditions.push(eq(wearableMetrics.source, filters.source));
    if (filters?.from) conditions.push(gte(wearableMetrics.recordedAt, new Date(filters.from)));
    if (filters?.to) conditions.push(lte(wearableMetrics.recordedAt, new Date(filters.to)));

    return await db
      .select()
      .from(wearableMetrics)
      .where(and(...conditions))
      .orderBy(desc(wearableMetrics.recordedAt))
      .limit(2000);
  }

  async getWearableMetricsSummary(patientId: number, from?: string, to?: string): Promise<{ metricType: string; avg: number; min: number; max: number; count: number; latestValue: string; unit: string }[]> {
    const conditions = [eq(wearableMetrics.patientId, patientId)];
    if (from) conditions.push(gte(wearableMetrics.recordedAt, new Date(from)));
    if (to) conditions.push(lte(wearableMetrics.recordedAt, new Date(to)));

    const result = await db
      .select({
        metricType: wearableMetrics.metricType,
        avg: sql<number>`AVG(${wearableMetrics.value}::numeric)::float`.as('avg'),
        min: sql<number>`MIN(${wearableMetrics.value}::numeric)::float`.as('min'),
        max: sql<number>`MAX(${wearableMetrics.value}::numeric)::float`.as('max'),
        count: sql<number>`COUNT(*)::int`.as('count'),
        latestValue: sql<string>`(SELECT value FROM wearable_metrics wm2 WHERE wm2.patient_id = ${wearableMetrics.patientId} AND wm2.metric_type = ${wearableMetrics.metricType} ORDER BY wm2.recorded_at DESC LIMIT 1)`.as('latestValue'),
        unit: sql<string>`(SELECT unit FROM wearable_metrics wm3 WHERE wm3.patient_id = ${wearableMetrics.patientId} AND wm3.metric_type = ${wearableMetrics.metricType} ORDER BY wm3.recorded_at DESC LIMIT 1)`.as('unit'),
      })
      .from(wearableMetrics)
      .where(and(...conditions))
      .groupBy(wearableMetrics.metricType, wearableMetrics.patientId);

    return result;
  }

  async getLatestWearableMetrics(patientId: number): Promise<WearableMetric[]> {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (metric_type) *
      FROM wearable_metrics
      WHERE patient_id = ${patientId}
      ORDER BY metric_type, recorded_at DESC
    `);
    return result.rows as WearableMetric[];
  }

  async deleteWearableMetric(id: number, patientId: number): Promise<void> {
    await db
      .delete(wearableMetrics)
      .where(and(eq(wearableMetrics.id, id), eq(wearableMetrics.patientId, patientId)));
  }
}

export const storage = new DatabaseStorage();
