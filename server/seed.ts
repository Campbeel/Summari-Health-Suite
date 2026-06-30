import { db } from "./db";
import {
  doctors,
  users,
  organizations,
  appointments,
  clinicalRecords,
  prescriptions,
  medicalInstructions,
  examOrders,
  conversations,
  messages,
  sessions,
  wearableMetrics,
  wearableConnections,
  reportTemplates,
  reimbursementRequests,
  consultationRatings,
  consultationMessages,
  patients,
  staffPatientCare,
  staffPatientAssignments,
  residentCareTasks,
} from "@shared/schema";
import bcrypt from "bcryptjs";

const STAFF_RUT = "22222222-2";
const ADMIN_RUT = "11111111-1";

export async function cleanAndSetupDatabase() {
  try {
    console.log("Running database cleanup...");

    await db.delete(examOrders);
    await db.delete(prescriptions);
    await db.delete(medicalInstructions);
    await db.delete(clinicalRecords).catch(() => {});
    await db.delete(consultationMessages).catch(() => {});
    await db.delete(consultationRatings).catch(() => {});
    await db.delete(reimbursementRequests).catch(() => {});
    await db.delete(reportTemplates).catch(() => {});
    await db.delete(staffPatientCare).catch(() => {});
    await db.delete(staffPatientAssignments).catch(() => {});
    await db.delete(residentCareTasks).catch(() => {});
    await db.delete(appointments);
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(sessions);
    await db.delete(wearableMetrics);
    await db.delete(wearableConnections).catch(() => {});
    await db.delete(patients);
    await db.delete(doctors);
    await db.delete(users);
    await db.delete(organizations).catch(() => {});

    const demoOrgId = `org_demo_${Math.random().toString(36).slice(2, 10)}`;
    await db.insert(organizations).values({
      id: demoOrgId,
      name: "Hogar Demo Las Acacias",
      rut: "76123456-7",
      contactEmail: "contacto@centrodemo.cl",
      contactPhone: "+56222345678",
      address: "Av. Providencia 1234, Santiago",
      isActive: true,
    });
    console.log(`Created demo organization (${demoOrgId})`);

    const staffPassword = await bcrypt.hash("staff123", 10);
    const adminPassword = await bcrypt.hash("admin", 10);

    const staffUserId = `user_staff_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(users).values({
      id: staffUserId,
      rut: STAFF_RUT,
      username: STAFF_RUT,
      firstName: "María",
      lastName: "González",
      email: "staff@centrodemo.cl",
      passwordHash: staffPassword,
      role: "staff",
      organizationId: demoOrgId,
      isAdmin: false,
    });
    await db.insert(doctors).values({
      userId: staffUserId,
      organizationId: demoOrgId,
      specialty: "Cuidado de residentes",
      licenseNumber: "STAFF-001",
      consultationFee: 0,
    });
    console.log(`Created demo staff (RUT ${STAFF_RUT} / staff123)`);

    const adminUserId = `user_admin_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(users).values({
      id: adminUserId,
      rut: ADMIN_RUT,
      username: ADMIN_RUT,
      firstName: "Ana",
      lastName: "Administradora",
      email: "admin@centrodemo.cl",
      passwordHash: adminPassword,
      role: "admin",
      organizationId: demoOrgId,
      isAdmin: true,
    });
    console.log(`Created demo admin (RUT ${ADMIN_RUT} / admin)`);

    const demoPatients = [
      {
        rut: "33333333-3",
        firstName: "Pedro",
        lastName: "Soto",
        email: "pedro.soto@email.cl",
        whatsapp: "+56912345678",
        dateOfBirth: "1945-05-15",
        gender: "masculino",
        bloodType: "O+",
        allergies: ["Penicilina"],
        medicalHistory: "Requiere ayuda para movilidad. Medicación matutina a las 08:00.",
      },
      {
        rut: "44444444-4",
        firstName: "Carmen",
        lastName: "Rivas",
        email: "carmen.rivas@email.cl",
        whatsapp: "+56987654321",
        dateOfBirth: "1938-11-03",
        gender: "femenino",
        bloodType: "A+",
        allergies: ["Látex", "Mariscos"],
        medicalHistory: "Usa andador. Alergia a látex en guantes.",
      },
      {
        rut: "55555555-5",
        firstName: "Luis",
        lastName: "Muñoz",
        email: "luis.munoz@email.cl",
        whatsapp: "+56911223344",
        dateOfBirth: "1950-08-22",
        gender: "masculino",
        bloodType: "B-",
        allergies: [] as string[],
        medicalHistory: "Dieta controlada. Control de glucosa dos veces al día.",
      },
    ];

    for (const p of demoPatients) {
      const patientUserId = `user_patient_${p.rut.replace(/-/g, "")}`;
      await db.insert(users).values({
        id: patientUserId,
        rut: p.rut,
        username: p.rut,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        role: "patient",
      });
      await db.insert(patients).values({
        userId: patientUserId,
        rut: p.rut,
        email: p.email,
        whatsapp: p.whatsapp,
        dateOfBirth: p.dateOfBirth,
        gender: p.gender,
        bloodType: p.bloodType,
        allergies: p.allergies,
        medicalHistory: p.medicalHistory,
      });
    }
    console.log(`Created ${demoPatients.length} demo resident(s)`);

    const residentRows = await db.select().from(patients);
    const byRut = (rut: string) => residentRows.find((r) => r.rut === rut)?.id;
    const now = Date.now();
    const staffName = "María González";

    const demoTasks = [
      { rut: "33333333-3", text: "Administrar medicación matutina", dueAt: new Date(now - 45 * 60 * 1000) },
      { rut: "44444444-4", text: "Acompañar al comedor del almuerzo", dueAt: new Date(now + 90 * 60 * 1000) },
      { rut: "55555555-5", text: "Control de glucosa pre-cena", dueAt: new Date(now + 10 * 60 * 60 * 1000) },
      { rut: "33333333-3", text: "Llamar a familiar de contacto", dueAt: new Date(now + 36 * 60 * 60 * 1000) },
      { rut: "44444444-4", text: "Cambio de ropa de cama", dueAt: new Date(now + 72 * 60 * 60 * 1000) },
    ];

    for (const t of demoTasks) {
      const patientId = byRut(t.rut);
      if (!patientId) continue;
      await db.insert(residentCareTasks).values({
        patientId,
        text: t.text,
        dueAt: t.dueAt,
        createdByUserId: staffUserId,
        createdByName: staffName,
      });
    }
    console.log(`Created ${demoTasks.length} demo care task(s)`);

    const finalUsers = await db.select().from(users);
    const finalStaff = await db.select().from(doctors);
    const finalOrgs = await db.select().from(organizations);
    console.log(
      `Database cleanup complete: ${finalUsers.length} user(s), ${finalStaff.length} staff profile(s), ${finalOrgs.length} org(s)`,
    );
  } catch (error) {
    console.error("Error during database cleanup:", error);
  }
}
