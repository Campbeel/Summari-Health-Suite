import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { db } from "./db";
import { users, patients, passwordResetTokens, organizations, doctors } from "@shared/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sendPasswordResetEmail } from "./email";

const JWT_SECRET: string = process.env.SESSION_SECRET!;
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
// Session lifetime upper bound. Combined with a client-side idle timeout this bounds the worst-case
// window where a stolen or forgotten session could be used. Longer than a typical clinical workday
// (so doctors aren't kicked out mid-shift) but far shorter than the 7d default we had.
const JWT_EXPIRY = "12h";

interface JwtPayload {
  userId: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const isAuthenticated: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error("[Auth] Token verification failed:", error instanceof Error ? error.message : "Unknown error");
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Build middleware that allows requests only when the user has one of the given roles.
export function requireRole(...allowed: string[]): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId));
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (!allowed.includes(user.role)) {
        return res.status(403).json({ message: "Forbidden", role: user.role });
      }
      // For org-scoped roles, enforce that the organization is still active.
      if ((user.role === "admin" || user.role === "doctor") && user.organizationId) {
        const [org] = await db.select().from(organizations).where(eq(organizations.id, user.organizationId));
        if (org && org.isActive === false) {
          return res.status(403).json({ message: "Organization is inactive" });
        }
      }
      // For doctor role, also block access if their doctor profile has been deactivated.
      if (user.role === "doctor") {
        const [doc] = await db.select().from(doctors).where(eq(doctors.userId, user.id));
        if (doc && doc.isActive === false) {
          return res.status(403).json({ message: "Doctor account is inactive" });
        }
      }
      // Stash on req for downstream handlers.
      (req as any).userRole = user.role;
      (req as any).userOrgId = user.organizationId;
      next();
    } catch (e) {
      console.error("[Auth] requireRole failed:", e);
      return res.status(500).json({ message: "Authorization check failed" });
    }
  };
}

function generateToken(userId: string, email: string): string {
  return jwt.sign({ userId, email } as JwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function validateRut(rut: string): boolean {
  const cleaned = rut.replace(/\./g, "").replace(/-/g, "");
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const checkDigit = cleaned.slice(-1).toUpperCase();
  if (!/^\d+$/.test(body)) return false;
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  let expected: string;
  if (remainder === 11) expected = "0";
  else if (remainder === 10) expected = "K";
  else expected = remainder.toString();
  return checkDigit === expected;
}

const registerSchema = z.object({
  rut: z.string()
    .min(1, "El RUT es requerido")
    .regex(/^(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])$/, "Formato de RUT inválido (ej: 12.345.678-9)")
    .refine((val) => validateRut(val), "El RUT ingresado no es válido"),
  email: z.string().email("Correo electrónico inválido"),
  whatsapp: z.string()
    .min(1, "El número de WhatsApp es requerido")
    .regex(/^\+\d{8,15}$/, "Formato inválido (ej: +56912345678)"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  firstName: z.string().min(1, "El nombre es requerido"),
  lastName: z.string().min(1, "El apellido es requerido"),
});

const loginSchema = z.object({
  identifier: z.string().min(1, "El RUT o correo electrónico es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const validation = registerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Datos inválidos",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      const { rut, email, whatsapp, password, firstName, lastName } = validation.data;

      const cleanedRut = rut.replace(/\./g, "");

      const [existingByRut] = await db.select().from(users).where(eq(users.rut, cleanedRut));
      if (existingByRut) {
        return res.status(409).json({ error: "Ya existe una cuenta con este RUT" });
      }

      const [existingByEmail] = await db.select().from(users).where(eq(users.email, email));
      if (existingByEmail) {
        return res.status(409).json({ error: "Ya existe una cuenta con este correo electrónico" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const [newUser] = await db.insert(users).values({
        email,
        rut: cleanedRut,
        whatsapp,
        passwordHash,
        firstName,
        lastName,
        username: email,
      }).returning();

      await db.insert(patients).values({
        userId: newUser.id,
        rut: cleanedRut,
        email,
        whatsapp,
      });

      const token = generateToken(newUser.id, newUser.email!);

      res.status(201).json({
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          rut: newUser.rut,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          profileImageUrl: newUser.profileImageUrl,
          isAdmin: newUser.isAdmin,
        },
      });
    } catch (error) {
      console.error("Error en registro:", error);
      res.status(500).json({ error: "Error al crear la cuenta" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Datos inválidos",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      const { identifier, password } = validation.data;

      let user;
      if (identifier.includes("@")) {
        const [found] = await db.select().from(users).where(eq(users.email, identifier));
        user = found;
      } else {
        const cleanedRut = identifier.replace(/\./g, "");
        const [found] = await db.select().from(users).where(eq(users.rut, cleanedRut));
        user = found;
      }

      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      const token = generateToken(user.id, user.email!);

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          rut: user.rut,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      console.error("Error en login:", error);
      res.status(500).json({ error: "Error al iniciar sesión" });
    }
  });

  const forgotPasswordSchema = z.object({
    identifier: z.string().min(1, "El RUT o correo electrónico es requerido"),
  });

  const forgotPasswordCooldowns = new Map<string, number>();

  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const validation = forgotPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Datos inválidos" });
      }

      const { identifier } = validation.data;
      const genericMessage = "Si existe una cuenta con esos datos, recibirás un correo con instrucciones.";

      const cooldownKey = identifier.toLowerCase();
      const lastRequest = forgotPasswordCooldowns.get(cooldownKey);
      if (lastRequest && Date.now() - lastRequest < 60000) {
        return res.json({ message: genericMessage });
      }
      forgotPasswordCooldowns.set(cooldownKey, Date.now());

      let user;
      if (identifier.includes("@")) {
        const [found] = await db.select().from(users).where(eq(users.email, identifier));
        user = found;
      } else {
        const cleanedRut = identifier.replace(/\./g, "");
        const [found] = await db.select().from(users).where(eq(users.rut, cleanedRut));
        user = found;
      }

      if (!user || !user.email) {
        return res.json({ message: genericMessage });
      }

      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.userId, user.id),
            isNull(passwordResetTokens.usedAt)
          )
        );

      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token: hashedToken,
        expiresAt,
      });

      try {
        await sendPasswordResetEmail(user.email, rawToken, user.firstName || "Usuario");
      } catch (emailError) {
        console.error("Error sending reset email:", emailError);
      }

      res.json({ message: genericMessage });
    } catch (error) {
      console.error("Error en forgot-password:", error);
      res.status(500).json({ error: "Error al procesar la solicitud" });
    }
  });

  const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token requerido"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  });

  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const validation = resetPasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Datos inválidos",
          errors: validation.error.flatten().fieldErrors,
        });
      }

      const { token, password } = validation.data;
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, hashedToken),
            gt(passwordResetTokens.expiresAt, new Date()),
            isNull(passwordResetTokens.usedAt)
          )
        );

      if (!resetToken) {
        return res.status(400).json({ error: "El enlace ha expirado o ya fue utilizado. Solicita uno nuevo." });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, resetToken.userId));

      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ message: "Tu contraseña ha sido restablecida correctamente." });
    } catch (error) {
      console.error("Error en reset-password:", error);
      res.status(500).json({ error: "Error al restablecer la contraseña" });
    }
  });

  app.get("/api/auth/verify-reset-token/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, hashedToken),
            gt(passwordResetTokens.expiresAt, new Date()),
            isNull(passwordResetTokens.usedAt)
          )
        );

      if (!resetToken) {
        return res.status(400).json({ valid: false, error: "El enlace ha expirado o ya fue utilizado." });
      }

      res.json({ valid: true });
    } catch (error) {
      console.error("Error verifying reset token:", error);
      res.status(500).json({ valid: false, error: "Error al verificar el enlace" });
    }
  });
}
