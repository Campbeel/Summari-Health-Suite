import { db } from "./db";
import { doctors, users } from "@shared/schema";
import { sql } from "drizzle-orm";

// Seed demo doctors for the telemedicine platform
export async function seedDoctors() {
  try {
    // Check if doctors already exist
    const existingDoctors = await db.select().from(doctors);
    if (existingDoctors.length > 0) {
      console.log("Doctors already seeded, skipping...");
      return;
    }

    // Create demo doctor users
    const doctorUsers = [
      {
        id: "doctor-1",
        username: "dr.garcia",
        email: "maria.garcia@summari.com",
        firstName: "María",
        lastName: "García",
        profileImageUrl: null,
      },
      {
        id: "doctor-2",
        username: "dr.rodriguez",
        email: "carlos.rodriguez@summari.com",
        firstName: "Carlos",
        lastName: "Rodríguez",
        profileImageUrl: null,
      },
      {
        id: "doctor-3",
        username: "dr.lopez",
        email: "ana.lopez@summari.com",
        firstName: "Ana",
        lastName: "López",
        profileImageUrl: null,
      },
    ];

    for (const user of doctorUsers) {
      await db
        .insert(users)
        .values(user)
        .onConflictDoNothing();
    }

    // Create doctor profiles
    const doctorProfiles = [
      {
        userId: "doctor-1",
        specialty: "Medicina General",
        licenseNumber: "MG-12345",
        bio: "Médico general con más de 15 años de experiencia en atención primaria. Especializada en medicina preventiva y manejo de enfermedades crónicas.",
        consultationFee: 5000, // $50.00
        availability: {
          monday: [{ start: "09:00", end: "17:00" }],
          tuesday: [{ start: "09:00", end: "17:00" }],
          wednesday: [{ start: "09:00", end: "17:00" }],
          thursday: [{ start: "09:00", end: "17:00" }],
          friday: [{ start: "09:00", end: "14:00" }],
        },
        isActive: true,
      },
      {
        userId: "doctor-2",
        specialty: "Cardiología",
        licenseNumber: "CA-67890",
        bio: "Cardiólogo certificado especializado en prevención y tratamiento de enfermedades cardiovasculares. Experiencia en ecocardiografía y pruebas de esfuerzo.",
        consultationFee: 7500, // $75.00
        availability: {
          monday: [{ start: "10:00", end: "18:00" }],
          tuesday: [{ start: "10:00", end: "18:00" }],
          wednesday: [{ start: "10:00", end: "18:00" }],
          thursday: [{ start: "10:00", end: "18:00" }],
        },
        isActive: true,
      },
      {
        userId: "doctor-3",
        specialty: "Dermatología",
        licenseNumber: "DE-11111",
        bio: "Dermatóloga con especialización en dermatología clínica y estética. Experta en tratamiento de acné, psoriasis y detección temprana de cáncer de piel.",
        consultationFee: 6000, // $60.00
        availability: {
          tuesday: [{ start: "08:00", end: "14:00" }],
          wednesday: [{ start: "08:00", end: "14:00" }],
          thursday: [{ start: "08:00", end: "14:00" }],
          friday: [{ start: "08:00", end: "14:00" }],
          saturday: [{ start: "09:00", end: "13:00" }],
        },
        isActive: true,
      },
    ];

    for (const doctor of doctorProfiles) {
      await db.insert(doctors).values(doctor);
    }

    console.log("Seeded 3 demo doctors successfully");
  } catch (error) {
    console.error("Error seeding doctors:", error);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDoctors()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
