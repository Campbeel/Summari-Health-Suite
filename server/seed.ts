import { db } from "./db";
import { doctors, patients, users, appointments, clinicalRecords, prescriptions, medicalInstructions, examOrders, conversations, messages, sessions, wearableMetrics, wearableConnections } from "@shared/schema";
import { eq, ne, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TARGET_RUT = "19684371-K";

export async function cleanAndSetupDatabase() {
  try {
    console.log("Running database cleanup...");

    const targetUsers = await db.select().from(users).where(eq(users.rut, TARGET_RUT));
    const targetUserId = targetUsers.length > 0 ? targetUsers[0].id : null;

    await db.delete(examOrders);
    await db.delete(prescriptions);
    await db.delete(medicalInstructions);
    await db.delete(clinicalRecords);
    await db.delete(appointments);
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(sessions);
    await db.delete(wearableMetrics);
    await db.delete(wearableConnections).catch(() => {});

    if (targetUserId) {
      await db.delete(doctors).where(ne(doctors.userId, targetUserId));
      await db.delete(patients).where(ne(patients.userId, targetUserId));
      await db.delete(users).where(ne(users.id, targetUserId));
    } else {
      await db.delete(doctors);
      await db.delete(patients);
      await db.delete(users);
    }

    if (!targetUserId) {
      const passwordHash = await bcrypt.hash("admin", 10);
      const newUserId = `user_${crypto.randomUUID()}`;
      await db.insert(users).values({
        id: newUserId,
        rut: TARGET_RUT,
        username: TARGET_RUT,
        firstName: "Usuario",
        lastName: "Prueba",
        email: "test@test.com",
        passwordHash,
      });

      await db.insert(doctors).values({
        userId: newUserId,
        specialty: "Medicina General",
        licenseNumber: "123456",
        consultationFee: 25000,
      });

      await db.insert(patients).values({
        userId: newUserId,
        rut: TARGET_RUT,
      });

      console.log("Created target user with doctor and patient profiles");
    } else {
      const existingDoctors = await db.select().from(doctors).where(eq(doctors.userId, targetUserId));
      if (existingDoctors.length === 0) {
        await db.insert(doctors).values({
          userId: targetUserId,
          specialty: "Medicina General",
          licenseNumber: "123456",
          consultationFee: 25000,
        });
      }

      const existingPatients = await db.select().from(patients).where(eq(patients.userId, targetUserId));
      if (existingPatients.length === 0) {
        await db.insert(patients).values({
          userId: targetUserId,
          rut: TARGET_RUT,
        });
      }

      console.log("Ensured target user has doctor and patient profiles");
    }

    const FELIX_RUT = "19892370-2";
    const existingFelix = await db.select().from(users).where(eq(users.rut, FELIX_RUT));
    if (existingFelix.length === 0) {
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
      console.log("Created test patient Felix Vargas");
    }

    const allDoctors = await db.select().from(doctors);
    const allPatients = await db.select().from(patients);
    if (allDoctors.length > 0 && allPatients.length > 0) {
      const existingAppts = await db.select().from(appointments);
      if (existingAppts.length === 0) {
        const doctorId = allDoctors[0].id;
        for (const patient of allPatients) {
          const today = new Date();
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(today.getDate() - 7);
          const twoWeeksAgo = new Date(today);
          twoWeeksAgo.setDate(today.getDate() - 14);

          await db.insert(appointments).values([
            {
              patientId: patient.id,
              doctorId,
              scheduledDate: twoWeeksAgo.toISOString().slice(0, 10),
              scheduledTime: "10:00:00",
              durationMinutes: 30,
              status: "completed",
              paymentStatus: "paid",
              consultationType: "video",
              notes: "Consulta de control",
            },
            {
              patientId: patient.id,
              doctorId,
              scheduledDate: oneWeekAgo.toISOString().slice(0, 10),
              scheduledTime: "15:00:00",
              durationMinutes: 30,
              status: "completed",
              paymentStatus: "paid",
              consultationType: "phone",
              notes: "Seguimiento",
            },
            {
              patientId: patient.id,
              doctorId,
              scheduledDate: today.toISOString().slice(0, 10),
              scheduledTime: patient.rut === FELIX_RUT ? "15:00:00" : "09:00:00",
              durationMinutes: 30,
              status: "scheduled",
              paymentStatus: "paid",
              consultationType: "video",
              notes: "Próxima consulta",
            },
          ]);
        }
        console.log("Created seed appointments");
      }
    }

    const finalUsers = await db.select().from(users);
    const finalDoctors = await db.select().from(doctors);
    const finalPatients = await db.select().from(patients);
    const finalAppts = await db.select().from(appointments);
    console.log(`Database cleanup complete: ${finalUsers.length} user(s), ${finalDoctors.length} doctor(s), ${finalPatients.length} patient(s), ${finalAppts.length} appointment(s)`);
  } catch (error) {
    console.error("Error during database cleanup:", error);
  }
}
