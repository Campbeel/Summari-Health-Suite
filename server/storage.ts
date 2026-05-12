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
  type InsertWearableMetric,
  wearableConnections,
  type WearableConnection,
  type InsertWearableConnection,
  examOrders,
  type ExamOrder,
  type InsertExamOrder,
  consultationMessages,
  type ConsultationMessage,
  type InsertConsultationMessage,
  consultationRatings,
  type ConsultationRating,
  type InsertConsultationRating,
  reimbursementRequests,
  type ReimbursementRequest,
  type InsertReimbursementRequest,
  ges,
  type GesDiagnosis,
  reportTemplates,
  type ReportTemplate,
  type InsertReportTemplate,
  organizations,
} from "@shared/schema";
import { eq, and, or, gte, lte, desc, sql, notInArray, isNull } from "drizzle-orm";

// Custom type definitions for joined queries
type DoctorWithUserInfo = {
  id: number;
  specialty: string;
  bio: string | null;
  consultationFee: number;
  availability: { [day: string]: { start: string; end: string }[] } | null;
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
  doctorId: number;
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
  appointmentId: number | null;
};

type InstructionWithDoctor = {
  id: number;
  category: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: Date;
  doctorName: string;
  doctorSpecialty: string | null;
  appointmentId: number | null;
};

type ExamOrderWithDoctor = {
  id: number;
  exams: Array<{
    name: string;
    instructions?: string;
  }>;
  clinicalJustification: string | null;
  issuedAt: Date;
  status: string;
  doctorName: string;
  doctorSpecialty: string | null;
  appointmentId: number | null;
};

type DoctorDashboardStats = {
  todayAppointments: number;
  upcomingAppointments: number;
  completedConsultations: number;
};

type PatientListItem = {
  id: number;
  userId: string;
  rut: string | null;
  email: string | null;
  whatsapp: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  allergies: string[] | null;
  medicalHistory: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  lastAppointmentDate: string | null;
  totalAppointments: number;
};

type PatientFullProfile = {
  id: number;
  userId: string;
  rut: string | null;
  email: string | null;
  whatsapp: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  allergies: string[] | null;
  medicalHistory: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
};

type PatientAppointmentHistory = {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  consultationType: string;
  notes: string | null;
  doctorName: string;
  doctorSpecialty: string | null;
  diagnosis: string | null;
  hasPrescription: boolean;
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
  updatePrescription(id: number, data: Partial<InsertPrescription> & { signedPdfData?: string | null; signedAt?: Date | null; status?: string }): Promise<Prescription>;
  getPrescriptionById(id: number): Promise<Prescription | undefined>;

  // Medical Instructions
  getMedicalInstruction(id: number): Promise<MedicalInstruction | undefined>;
  getInstructionsByPatient(patientId: number): Promise<MedicalInstruction[]>;
  getInstructionsWithDoctorByPatient(patientId: number): Promise<InstructionWithDoctor[]>;
  getInstructionsByRecordId(clinicalRecordId: number): Promise<MedicalInstruction[]>;
  deleteInstructionsByRecordId(clinicalRecordId: number): Promise<void>;
  createMedicalInstruction(instruction: InsertMedicalInstruction): Promise<MedicalInstruction>;
  updateMedicalInstruction(id: number, data: Partial<InsertMedicalInstruction> & { signedPdfData?: string | null; signedAt?: Date | null; status?: string }): Promise<MedicalInstruction>;

  // Wearable Metrics
  createWearableMetric(metric: InsertWearableMetric): Promise<WearableMetric>;
  createWearableMetrics(metrics: InsertWearableMetric[]): Promise<WearableMetric[]>;
  getWearableMetrics(patientId: number, filters?: { metricType?: string; from?: string; to?: string; source?: string }): Promise<WearableMetric[]>;
  getWearableMetricsSummary(patientId: number, from?: string, to?: string): Promise<{ metricType: string; avg: number; min: number; max: number; count: number; latestValue: string; unit: string }[]>;
  getLatestWearableMetrics(patientId: number): Promise<WearableMetric[]>;
  deleteWearableMetric(id: number, patientId: number): Promise<void>;

  // Wearable Connections
  getWearableConnection(patientId: number, provider: string): Promise<WearableConnection | undefined>;
  getWearableConnections(patientId: number): Promise<WearableConnection[]>;
  getAllActiveWearableConnections(provider: string): Promise<WearableConnection[]>;
  createWearableConnection(connection: InsertWearableConnection): Promise<WearableConnection>;
  updateWearableConnection(id: number, data: Partial<InsertWearableConnection>): Promise<WearableConnection>;
  deleteWearableConnection(patientId: number, provider: string): Promise<void>;

  // Exam Orders
  getExamOrdersByRecordId(clinicalRecordId: number): Promise<ExamOrder[]>;
  getExamOrdersWithDoctorByPatient(patientId: number): Promise<ExamOrderWithDoctor[]>;
  deleteExamOrdersByRecordId(clinicalRecordId: number): Promise<void>;
  createExamOrder(examOrder: InsertExamOrder): Promise<ExamOrder>;
  getExamOrderById(id: number): Promise<ExamOrder | undefined>;
  updateExamOrder(id: number, data: Partial<InsertExamOrder> & { signedPdfData?: string | null; signedAt?: Date | null; status?: string }): Promise<ExamOrder>;

  // Consultation Messages
  getConsultationMessages(appointmentId: number): Promise<ConsultationMessage[]>;
  createConsultationMessage(message: InsertConsultationMessage): Promise<ConsultationMessage>;
  getConsultationMessagesByPatientDoctor(doctorId: number, patientId: number): Promise<Array<ConsultationMessage & { doctorId: number }>>;

  // Consultation Ratings
  getConsultationRating(appointmentId: number): Promise<ConsultationRating | undefined>;
  createConsultationRating(rating: InsertConsultationRating): Promise<ConsultationRating>;

  // Doctor Patient Management
  getAllPatientsForDoctor(doctorId: number, search?: string): Promise<PatientListItem[]>;
  getPatientFullProfile(patientId: number): Promise<PatientFullProfile | undefined>;
  getPatientAppointmentHistory(patientId: number): Promise<PatientAppointmentHistory[]>;
  doctorHasPatientRelationship(doctorId: number, patientId: number): Promise<boolean>;

  // Reimbursement Requests
  createReimbursementRequest(request: InsertReimbursementRequest): Promise<ReimbursementRequest>;
  getReimbursementRequestsByPatient(patientId: number): Promise<ReimbursementRequest[]>;
  getReimbursementRequestByAppointment(appointmentId: number): Promise<ReimbursementRequest | undefined>;
  updateReimbursementRequest(id: number, data: Partial<InsertReimbursementRequest>): Promise<ReimbursementRequest>;

  // Report Templates
  getReportTemplatesByDoctor(doctorId: number): Promise<ReportTemplate[]>;
  getReportTemplate(id: number): Promise<ReportTemplate | undefined>;
  createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate>;
  updateReportTemplate(id: number, data: Partial<InsertReportTemplate>): Promise<ReportTemplate>;
  deleteReportTemplate(id: number): Promise<void>;
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
        specialty: doctors.specialty,
        bio: doctors.bio,
        consultationFee: doctors.consultationFee,
        availability: doctors.availability,
        userName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`.as('userName'),
        userImage: users.profileImageUrl,
      })
      .from(doctors)
      .leftJoin(users, eq(doctors.userId, users.id))
      .leftJoin(organizations, eq(doctors.organizationId, organizations.id))
      // Active doctor AND (no org OR org is active) — independents and active-org doctors only.
      .where(and(
        eq(doctors.isActive, true),
        or(isNull(doctors.organizationId), eq(organizations.isActive, true)),
      ));
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
        doctorId: appointments.doctorId,
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
        doctorId: appointments.doctorId,
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
        signedPdfData: prescriptions.signedPdfData,
        signedAt: prescriptions.signedAt,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
      })
      .from(prescriptions)
      .leftJoin(doctors, eq(prescriptions.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(prescriptions.clinicalRecordId, clinicalRecordId));
    return result[0] as any;
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
        appointmentId: clinicalRecords.appointmentId,
      })
      .from(prescriptions)
      .leftJoin(clinicalRecords, eq(prescriptions.clinicalRecordId, clinicalRecords.id))
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

  async getInstructionsWithDoctorByPatient(patientId: number): Promise<InstructionWithDoctor[]> {
    const result = await db
      .select({
        id: medicalInstructions.id,
        category: medicalInstructions.category,
        title: medicalInstructions.title,
        description: medicalInstructions.description,
        priority: medicalInstructions.priority,
        dueDate: medicalInstructions.dueDate,
        isCompleted: medicalInstructions.isCompleted,
        createdAt: medicalInstructions.createdAt,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        appointmentId: clinicalRecords.appointmentId,
      })
      .from(medicalInstructions)
      .leftJoin(clinicalRecords, eq(medicalInstructions.clinicalRecordId, clinicalRecords.id))
      .leftJoin(doctors, eq(medicalInstructions.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(medicalInstructions.patientId, patientId))
      .orderBy(desc(medicalInstructions.createdAt));
    return result;
  }

  async updatePrescription(id: number, data: Partial<InsertPrescription> & { signedPdfData?: string | null; signedAt?: Date | null; status?: string }): Promise<Prescription> {
    const [updated] = await db
      .update(prescriptions)
      .set(data as any)
      .where(eq(prescriptions.id, id))
      .returning();
    return updated;
  }

  async getPrescriptionById(id: number): Promise<Prescription | undefined> {
    const [p] = await db.select().from(prescriptions).where(eq(prescriptions.id, id));
    return p;
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

  async updateMedicalInstruction(id: number, data: Partial<InsertMedicalInstruction> & { signedPdfData?: string | null; signedAt?: Date | null; status?: string }): Promise<MedicalInstruction> {
    const [updated] = await db.update(medicalInstructions).set(data as any).where(eq(medicalInstructions.id, id)).returning();
    return updated;
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

  async getWearableConnection(patientId: number, provider: string): Promise<WearableConnection | undefined> {
    const [conn] = await db
      .select()
      .from(wearableConnections)
      .where(and(eq(wearableConnections.patientId, patientId), eq(wearableConnections.provider, provider)));
    return conn;
  }

  async getWearableConnections(patientId: number): Promise<WearableConnection[]> {
    return db
      .select()
      .from(wearableConnections)
      .where(eq(wearableConnections.patientId, patientId));
  }

  async getAllActiveWearableConnections(provider: string): Promise<WearableConnection[]> {
    return db
      .select()
      .from(wearableConnections)
      .where(and(eq(wearableConnections.provider, provider), eq(wearableConnections.isActive, true)));
  }

  async createWearableConnection(connection: InsertWearableConnection): Promise<WearableConnection> {
    const [conn] = await db
      .insert(wearableConnections)
      .values(connection)
      .returning();
    return conn;
  }

  async updateWearableConnection(id: number, data: Partial<InsertWearableConnection>): Promise<WearableConnection> {
    const [conn] = await db
      .update(wearableConnections)
      .set(data)
      .where(eq(wearableConnections.id, id))
      .returning();
    return conn;
  }

  async deleteWearableConnection(patientId: number, provider: string): Promise<void> {
    await db
      .delete(wearableConnections)
      .where(and(eq(wearableConnections.patientId, patientId), eq(wearableConnections.provider, provider)));
  }

  // Exam Orders
  async getExamOrdersByRecordId(clinicalRecordId: number): Promise<ExamOrder[]> {
    return await db.select().from(examOrders).where(eq(examOrders.clinicalRecordId, clinicalRecordId));
  }

  async getExamOrdersWithDoctorByPatient(patientId: number): Promise<ExamOrderWithDoctor[]> {
    const result = await db
      .select({
        id: examOrders.id,
        exams: examOrders.exams,
        clinicalJustification: examOrders.clinicalJustification,
        issuedAt: examOrders.issuedAt,
        status: examOrders.status,
        doctorName: sql<string>`COALESCE(u.first_name || ' ' || u.last_name, u.email)`.as('doctorName'),
        doctorSpecialty: doctors.specialty,
        appointmentId: clinicalRecords.appointmentId,
      })
      .from(examOrders)
      .leftJoin(clinicalRecords, eq(examOrders.clinicalRecordId, clinicalRecords.id))
      .leftJoin(doctors, eq(examOrders.doctorId, doctors.id))
      .leftJoin(sql`users u`, sql`${doctors.userId} = u.id`)
      .where(eq(examOrders.patientId, patientId))
      .orderBy(desc(examOrders.issuedAt));
    return result;
  }

  async deleteExamOrdersByRecordId(clinicalRecordId: number): Promise<void> {
    await db.delete(examOrders).where(eq(examOrders.clinicalRecordId, clinicalRecordId));
  }

  async createExamOrder(examOrder: InsertExamOrder): Promise<ExamOrder> {
    const [created] = await db.insert(examOrders).values(examOrder).returning();
    return created;
  }

  async getExamOrderById(id: number): Promise<ExamOrder | undefined> {
    const [e] = await db.select().from(examOrders).where(eq(examOrders.id, id));
    return e;
  }

  async updateExamOrder(id: number, data: Partial<InsertExamOrder> & { signedPdfData?: string | null; signedAt?: Date | null; status?: string }): Promise<ExamOrder> {
    const [updated] = await db.update(examOrders).set(data as any).where(eq(examOrders.id, id)).returning();
    return updated;
  }

  // Consultation Messages
  async getConsultationMessages(appointmentId: number): Promise<ConsultationMessage[]> {
    return await db.select().from(consultationMessages)
      .where(eq(consultationMessages.appointmentId, appointmentId))
      .orderBy(consultationMessages.createdAt);
  }

  async createConsultationMessage(message: InsertConsultationMessage): Promise<ConsultationMessage> {
    const [created] = await db.insert(consultationMessages).values(message).returning();
    return created;
  }

  async getConsultationMessagesByPatientDoctor(doctorId: number, patientId: number): Promise<Array<ConsultationMessage & { doctorId: number }>> {
    const result = await db
      .select({
        id: consultationMessages.id,
        appointmentId: consultationMessages.appointmentId,
        senderUserId: consultationMessages.senderUserId,
        senderRole: consultationMessages.senderRole,
        content: consultationMessages.content,
        fileName: consultationMessages.fileName,
        fileUrl: consultationMessages.fileUrl,
        fileType: consultationMessages.fileType,
        fileSize: consultationMessages.fileSize,
        createdAt: consultationMessages.createdAt,
        doctorId: appointments.doctorId,
      })
      .from(consultationMessages)
      .innerJoin(appointments, eq(consultationMessages.appointmentId, appointments.id))
      .where(and(eq(appointments.doctorId, doctorId), eq(appointments.patientId, patientId)))
      .orderBy(consultationMessages.createdAt);
    return result as any;
  }

  async getConsultationRating(appointmentId: number): Promise<ConsultationRating | undefined> {
    const [rating] = await db.select().from(consultationRatings)
      .where(eq(consultationRatings.appointmentId, appointmentId));
    return rating;
  }

  async createConsultationRating(rating: InsertConsultationRating): Promise<ConsultationRating> {
    const [created] = await db.insert(consultationRatings).values(rating).returning();
    return created;
  }

  async getAllPatientsForDoctor(doctorId: number, search?: string): Promise<PatientListItem[]> {
    const doctorPatientIds = await db
      .selectDistinct({ patientId: appointments.patientId })
      .from(appointments)
      .where(eq(appointments.doctorId, doctorId));

    const patientIds = doctorPatientIds.map((r) => r.patientId);
    if (patientIds.length === 0) return [];

    const result = await db
      .select({
        id: patients.id,
        userId: patients.userId,
        rut: patients.rut,
        email: patients.email,
        whatsapp: patients.whatsapp,
        dateOfBirth: patients.dateOfBirth,
        gender: patients.gender,
        bloodType: patients.bloodType,
        allergies: patients.allergies,
        medicalHistory: patients.medicalHistory,
        emergencyContact: patients.emergencyContact,
        emergencyPhone: patients.emergencyPhone,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        lastAppointmentDate: sql<string>`MAX(${appointments.scheduledDate})`.as("last_appointment_date"),
        totalAppointments: sql<number>`COUNT(${appointments.id})::int`.as("total_appointments"),
      })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.id))
      .leftJoin(appointments, eq(appointments.patientId, patients.id))
      .where(sql`${patients.id} IN (${sql.join(patientIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(patients.id, users.id)
      .orderBy(desc(sql`MAX(${appointments.scheduledDate})`));

    if (search && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      return result.filter((p) => {
        const fullName = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
        const rut = (p.rut || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        return fullName.includes(searchLower) || rut.includes(searchLower) || email.includes(searchLower);
      });
    }

    return result;
  }

  async getPatientFullProfile(patientId: number): Promise<PatientFullProfile | undefined> {
    const [result] = await db
      .select({
        id: patients.id,
        userId: patients.userId,
        rut: patients.rut,
        email: patients.email,
        whatsapp: patients.whatsapp,
        dateOfBirth: patients.dateOfBirth,
        gender: patients.gender,
        bloodType: patients.bloodType,
        allergies: patients.allergies,
        medicalHistory: patients.medicalHistory,
        emergencyContact: patients.emergencyContact,
        emergencyPhone: patients.emergencyPhone,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
      })
      .from(patients)
      .innerJoin(users, eq(patients.userId, users.id))
      .where(eq(patients.id, patientId));
    return result;
  }

  async getPatientAppointmentHistory(patientId: number): Promise<PatientAppointmentHistory[]> {
    const result = await db
      .select({
        id: appointments.id,
        scheduledDate: appointments.scheduledDate,
        scheduledTime: appointments.scheduledTime,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        consultationType: appointments.consultationType,
        notes: appointments.notes,
        doctorFirstName: users.firstName,
        doctorLastName: users.lastName,
        doctorSpecialty: doctors.specialty,
        diagnosis: clinicalRecords.diagnosis,
        prescriptionId: prescriptions.id,
      })
      .from(appointments)
      .innerJoin(doctors, eq(appointments.doctorId, doctors.id))
      .innerJoin(users, eq(doctors.userId, users.id))
      .leftJoin(clinicalRecords, eq(clinicalRecords.appointmentId, appointments.id))
      .leftJoin(prescriptions, eq(prescriptions.clinicalRecordId, clinicalRecords.id))
      .where(eq(appointments.patientId, patientId))
      .orderBy(desc(appointments.scheduledDate), desc(appointments.scheduledTime));

    return result.map((r) => ({
      id: r.id,
      scheduledDate: r.scheduledDate,
      scheduledTime: r.scheduledTime,
      durationMinutes: r.durationMinutes,
      status: r.status,
      consultationType: r.consultationType,
      notes: r.notes,
      doctorName: r.doctorFirstName ? `Dr. ${r.doctorFirstName} ${r.doctorLastName}` : "Doctor",
      doctorSpecialty: r.doctorSpecialty,
      diagnosis: r.diagnosis,
      hasPrescription: r.prescriptionId !== null,
    }));
  }

  async doctorHasPatientRelationship(doctorId: number, patientId: number): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(appointments)
      .where(and(eq(appointments.doctorId, doctorId), eq(appointments.patientId, patientId)));
    return (result?.count || 0) > 0;
  }

  async createReimbursementRequest(request: InsertReimbursementRequest): Promise<ReimbursementRequest> {
    const [result] = await db.insert(reimbursementRequests).values(request).returning();
    return result;
  }

  async getReimbursementRequestsByPatient(patientId: number): Promise<ReimbursementRequest[]> {
    return await db.select().from(reimbursementRequests)
      .where(eq(reimbursementRequests.patientId, patientId))
      .orderBy(desc(reimbursementRequests.createdAt));
  }

  async getReimbursementRequestByAppointment(appointmentId: number): Promise<ReimbursementRequest | undefined> {
    const [result] = await db.select().from(reimbursementRequests)
      .where(eq(reimbursementRequests.appointmentId, appointmentId));
    return result;
  }

  async updateReimbursementRequest(id: number, data: Partial<InsertReimbursementRequest>): Promise<ReimbursementRequest> {
    const [result] = await db.update(reimbursementRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reimbursementRequests.id, id))
      .returning();
    return result;
  }

  async searchGes(query: string, limit: number = 20): Promise<GesDiagnosis[]> {
    const results = await db.execute(sql`
      SELECT DISTINCT ON (id_problema, "código_cie-10")
        id_problema, problema_de_salud, "código_cie-10", descriptor,
        similarity(descriptor, ${query}) AS sim_desc,
        similarity(problema_de_salud, ${query}) AS sim_prob
      FROM ges
      WHERE descriptor % ${query}
         OR problema_de_salud % ${query}
         OR descriptor ILIKE ${'%' + query + '%'}
         OR problema_de_salud ILIKE ${'%' + query + '%'}
         OR "código_cie-10" ILIKE ${'%' + query + '%'}
      ORDER BY id_problema, "código_cie-10",
        GREATEST(similarity(descriptor, ${query}), similarity(problema_de_salud, ${query})) DESC
      LIMIT ${limit}
    `);
    return (results.rows as any[]).map(r => ({
      idProblema: r.id_problema,
      problemaDeSalud: r.problema_de_salud,
      codigoCie10: r["código_cie-10"],
      descriptor: r.descriptor,
    }));
  }

  async searchGesProblems(query: string): Promise<{ idProblema: number; problemaDeSalud: string }[]> {
    const results = await db.execute(sql`
      SELECT DISTINCT id_problema, problema_de_salud
      FROM ges
      WHERE problema_de_salud % ${query}
         OR problema_de_salud ILIKE ${'%' + query + '%'}
      ORDER BY similarity(problema_de_salud, ${query}) DESC
      LIMIT 15
    `);
    return (results.rows as any[]).map(r => ({
      idProblema: r.id_problema,
      problemaDeSalud: r.problema_de_salud,
    }));
  }

  async getGesDescriptorsByProblem(idProblema: number): Promise<GesDiagnosis[]> {
    const results = await db.execute(sql`
      SELECT id_problema, problema_de_salud, "código_cie-10", descriptor
      FROM ges
      WHERE id_problema = ${idProblema}
      ORDER BY descriptor ASC
    `);
    return (results.rows as any[]).map(r => ({
      idProblema: r.id_problema,
      problemaDeSalud: r.problema_de_salud,
      codigoCie10: r["código_cie-10"],
      descriptor: r.descriptor,
    }));
  }

  async matchGesFromDiagnosis(diagnosisText: string): Promise<GesDiagnosis[]> {
    const results = await db.execute(sql`
      SELECT DISTINCT ON ("código_cie-10")
        id_problema, problema_de_salud, "código_cie-10", descriptor,
        GREATEST(
          similarity(descriptor, ${diagnosisText}),
          similarity(problema_de_salud, ${diagnosisText})
        ) AS score
      FROM ges
      WHERE descriptor % ${diagnosisText}
         OR problema_de_salud % ${diagnosisText}
         OR descriptor ILIKE ${'%' + diagnosisText + '%'}
         OR problema_de_salud ILIKE ${'%' + diagnosisText + '%'}
      ORDER BY "código_cie-10",
        GREATEST(similarity(descriptor, ${diagnosisText}), similarity(problema_de_salud, ${diagnosisText})) DESC
      LIMIT 5
    `);
    return (results.rows as any[]).map(r => ({
      idProblema: r.id_problema,
      problemaDeSalud: r.problema_de_salud,
      codigoCie10: r["código_cie-10"],
      descriptor: r.descriptor,
    }));
  }

  async getReportTemplatesByDoctor(doctorId: number): Promise<ReportTemplate[]> {
    return db.select().from(reportTemplates)
      .where(eq(reportTemplates.doctorId, doctorId))
      .orderBy(desc(reportTemplates.isDefault), reportTemplates.name);
  }

  async getReportTemplate(id: number): Promise<ReportTemplate | undefined> {
    const [template] = await db.select().from(reportTemplates).where(eq(reportTemplates.id, id));
    return template;
  }

  async createReportTemplate(template: InsertReportTemplate): Promise<ReportTemplate> {
    if (template.isDefault) {
      await db.update(reportTemplates)
        .set({ isDefault: false })
        .where(eq(reportTemplates.doctorId, template.doctorId));
    }
    const [created] = await db.insert(reportTemplates).values(template).returning();
    return created;
  }

  async updateReportTemplate(id: number, data: Partial<InsertReportTemplate>): Promise<ReportTemplate> {
    if (data.isDefault) {
      const existing = await this.getReportTemplate(id);
      if (existing) {
        await db.update(reportTemplates)
          .set({ isDefault: false })
          .where(eq(reportTemplates.doctorId, existing.doctorId));
      }
    }
    const [updated] = await db.update(reportTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reportTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteReportTemplate(id: number): Promise<void> {
    await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  }
}

export const storage = new DatabaseStorage();
