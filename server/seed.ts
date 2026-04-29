import { db } from "./db";
import { doctors, patients, users, appointments, clinicalRecords, prescriptions, medicalInstructions, examOrders, conversations, messages, sessions, wearableMetrics, wearableConnections, organizations, reportTemplates, reimbursementRequests, consultationRatings, consultationMessages } from "@shared/schema";
import { eq, ne, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TARGET_RUT = "19684371-K";       // demo doctor (was dual-role)
const FELIX_RUT = "19892370-2";         // demo patient
const ADMIN_RUT = "11111111-1";         // demo org admin
const SUPERADMIN_RUT = "99999999-9";    // demo super admin

export async function cleanAndSetupDatabase() {
  try {
    console.log("Running database cleanup...");

    const targetUsers = await db.select().from(users).where(eq(users.rut, TARGET_RUT));
    const targetUserId = targetUsers.length > 0 ? targetUsers[0].id : null;

    // Wipe per-session content
    await db.delete(examOrders);
    await db.delete(prescriptions);
    await db.delete(medicalInstructions);
    await db.delete(clinicalRecords).catch(() => {});
    await db.delete(consultationMessages).catch(() => {});
    await db.delete(consultationRatings).catch(() => {});
    await db.delete(reimbursementRequests).catch(() => {});
    await db.delete(reportTemplates).catch(() => {});
    await db.delete(appointments);
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(sessions);
    await db.delete(wearableMetrics);
    await db.delete(wearableConnections).catch(() => {});

    // Reset users (preserve target user id if present)
    if (targetUserId) {
      await db.delete(doctors).where(ne(doctors.userId, targetUserId));
      await db.delete(patients).where(ne(patients.userId, targetUserId));
      // Drop ALL prior patient row for the target user (we are enforcing single role)
      await db.delete(patients).where(eq(patients.userId, targetUserId));
      await db.delete(users).where(ne(users.id, targetUserId));
    } else {
      await db.delete(doctors);
      await db.delete(patients);
      await db.delete(users);
    }

    // Wipe all orgs (we recreate the demo org below)
    await db.delete(organizations).catch(() => {});

    // ----- Demo organization -----
    const demoOrgId = `org_demo_${Math.random().toString(36).slice(2, 10)}`;
    await db.insert(organizations).values({
      id: demoOrgId,
      name: "Clínica Demo",
      rut: "76123456-7",
      contactEmail: "contacto@clinicademo.cl",
      contactPhone: "+56222345678",
      address: "Av. Providencia 1234, Santiago",
      isActive: true,
    });
    console.log(`Created demo organization (${demoOrgId})`);

    // ----- Demo doctor (the target user) -----
    const passwordHash = await bcrypt.hash("admin", 10);
    let doctorUserId: string;
    if (!targetUserId) {
      doctorUserId = `user_${crypto.randomUUID()}`;
      await db.insert(users).values({
        id: doctorUserId,
        rut: TARGET_RUT,
        username: TARGET_RUT,
        firstName: "Usuario",
        lastName: "Prueba",
        email: "doctor@summari.cl",
        passwordHash,
        role: "doctor",
        organizationId: demoOrgId,
        isAdmin: false,
      });
    } else {
      doctorUserId = targetUserId;
      await db.update(users)
        .set({ role: "doctor", organizationId: demoOrgId, isAdmin: false })
        .where(eq(users.id, doctorUserId));
    }

    const existingDoctors = await db.select().from(doctors).where(eq(doctors.userId, doctorUserId));
    if (existingDoctors.length === 0) {
      await db.insert(doctors).values({
        userId: doctorUserId,
        organizationId: demoOrgId,
        specialty: "Medicina General",
        licenseNumber: "123456",
        consultationFee: 25000,
      });
    } else {
      await db.update(doctors)
        .set({ organizationId: demoOrgId })
        .where(eq(doctors.userId, doctorUserId));
    }
    console.log("Ensured demo doctor (RUT 19684371-K) is org-affiliated, role=doctor");

    // ----- Demo patient (Felix) -----
    const felixPassword = await bcrypt.hash("felix123", 10);
    const felixUserId = `user_felix_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(users).values({
      id: felixUserId,
      rut: FELIX_RUT,
      username: FELIX_RUT,
      firstName: "Felix",
      lastName: "Vargas",
      email: "felix.vargas.cs@gmail.com",
      whatsapp: "+56912345678",
      passwordHash: felixPassword,
      role: "patient",
      organizationId: null,
    });
    await db.insert(patients).values({
      userId: felixUserId,
      rut: FELIX_RUT,
      email: "felix.vargas.cs@gmail.com",
      whatsapp: "+56912345678",
      dateOfBirth: "1995-06-15",
      gender: "Masculino",
      bloodType: "O+",
      allergies: ["Penicilina", "Mariscos"],
      medicalHistory: "Hipertensión arterial controlada, diabetes tipo 2",
      emergencyContact: "María Vargas",
      emergencyPhone: "+56998765432",
    });
    console.log("Created demo patient Felix Vargas (RUT 19892370-2 / felix123)");

    // ----- Demo org admin -----
    const adminUserId = `user_admin_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(users).values({
      id: adminUserId,
      rut: ADMIN_RUT,
      username: ADMIN_RUT,
      firstName: "Ana",
      lastName: "Admin",
      email: "admin@clinicademo.cl",
      passwordHash,
      role: "admin",
      organizationId: demoOrgId,
      isAdmin: true,
    });
    console.log("Created demo org admin (RUT 11111111-1 / admin)");

    // ----- Demo super admin -----
    const superAdminUserId = `user_super_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(users).values({
      id: superAdminUserId,
      rut: SUPERADMIN_RUT,
      username: SUPERADMIN_RUT,
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@summari.cl",
      passwordHash,
      role: "superAdmin",
      organizationId: null,
      isAdmin: true,
    });
    console.log("Created demo super admin (RUT 99999999-9 / admin)");

    // ----- Seed appointments (for stats) -----
    const allDoctors = await db.select().from(doctors);
    const allPatients = await db.select().from(patients);
    if (allDoctors.length > 0 && allPatients.length > 0) {
      const doctorId = allDoctors[0].id;
      const patient = allPatients[0];
      const today = new Date();

      const dayOffset = (n: number) => {
        const d = new Date(today);
        d.setDate(today.getDate() + n);
        return d.toISOString().slice(0, 10);
      };

      await db.insert(appointments).values([
        // Past completed (paid) - revenue
        {
          patientId: patient.id, doctorId,
          scheduledDate: dayOffset(-14), scheduledTime: "10:00:00",
          durationMinutes: 30, status: "completed", paymentStatus: "paid",
          consultationType: "video", notes: "Consulta de control",
        },
        {
          patientId: patient.id, doctorId,
          scheduledDate: dayOffset(-7), scheduledTime: "15:00:00",
          durationMinutes: 30, status: "completed", paymentStatus: "paid",
          consultationType: "phone", notes: "Seguimiento",
        },
        // Lost (cancelled / no-show)
        {
          patientId: patient.id, doctorId,
          scheduledDate: dayOffset(-3), scheduledTime: "11:00:00",
          durationMinutes: 30, status: "cancelled", paymentStatus: "rejected",
          consultationType: "video", notes: "Cancelada por paciente",
        },
        // Upcoming scheduled (paid)
        {
          patientId: patient.id, doctorId,
          scheduledDate: dayOffset(0), scheduledTime: "15:00:00",
          durationMinutes: 30, status: "scheduled", paymentStatus: "paid",
          consultationType: "video", notes: "Próxima consulta",
        },
        // Pending payment
        {
          patientId: patient.id, doctorId,
          scheduledDate: dayOffset(2), scheduledTime: "09:00:00",
          durationMinutes: 30, status: "scheduled", paymentStatus: "pending",
          consultationType: "video", notes: "Pago pendiente",
        },
      ]);
      console.log("Created seed appointments");
    }

    const finalUsers = await db.select().from(users);
    const finalDoctors = await db.select().from(doctors);
    const finalPatients = await db.select().from(patients);
    const finalAppts = await db.select().from(appointments);
    const finalOrgs = await db.select().from(organizations);
    console.log(`Database cleanup complete: ${finalUsers.length} user(s), ${finalDoctors.length} doctor(s), ${finalPatients.length} patient(s), ${finalAppts.length} appointment(s), ${finalOrgs.length} org(s)`);
  } catch (error) {
    console.error("Error during database cleanup:", error);
  }
}
