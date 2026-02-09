import { db } from "./db";
import { doctors, patients, users, appointments, clinicalRecords, prescriptions, medicalInstructions, conversations, messages, sessions } from "@shared/schema";
import { eq, ne, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const TARGET_RUT = "19.684.371-K";

export async function cleanAndSetupDatabase() {
  try {
    console.log("Running database cleanup...");

    const targetUsers = await db.select().from(users).where(eq(users.rut, TARGET_RUT));
    const targetUserId = targetUsers.length > 0 ? targetUsers[0].id : null;

    await db.delete(prescriptions);
    await db.delete(medicalInstructions);
    await db.delete(clinicalRecords);
    await db.delete(appointments);
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(sessions);

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

    const finalUsers = await db.select().from(users);
    const finalDoctors = await db.select().from(doctors);
    const finalPatients = await db.select().from(patients);
    console.log(`Database cleanup complete: ${finalUsers.length} user(s), ${finalDoctors.length} doctor(s), ${finalPatients.length} patient(s)`);
  } catch (error) {
    console.error("Error during database cleanup:", error);
  }
}
