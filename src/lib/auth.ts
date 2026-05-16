import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "agentflow_session";

function secret() {
  return process.env.SESSION_SECRET || "local-development-secret";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function createSession(userId: string) {
  const nonce = randomBytes(12).toString("base64url");
  const value = `${userId}.${Date.now()}.${nonce}`;
  const token = `${value}.${sign(value)}`;
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 14,
    path: "/"
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const value = parts.slice(0, 3).join(".");
  const expected = sign(value);
  const actual = parts[3];

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return prisma.user.findUnique({
    where: { id: parts[0] },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatarColor: true,
      role: true,
      approved: true,
      mustChangePassword: true,
      createdAt: true
    }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }
  if (!user.approved) {
    await clearSession();
    const error = new Error("Konto czeka na akceptacje admina.");
    error.name = "UnauthorizedError";
    throw error;
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    const error = new Error("Tylko admin moze wykonac te operacje.");
    error.name = "UnauthorizedError";
    throw error;
  }
  return user;
}

export async function ensureAdminAccount() {
  const adminExists = await prisma.user.findUnique({ where: { username: "admin" } });
  if (!adminExists) {
    const bcrypt = (await import("bcryptjs")).default;
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        name: "Administrator",
        username: "admin",
        email: "admin@admin.com",
        passwordHash,
        role: "ADMIN",
        approved: true,
        mustChangePassword: true
      }
    });
  } else if (adminExists.role !== "ADMIN") {
    await prisma.user.update({
      where: { id: adminExists.id },
      data: { role: "ADMIN" }
    });
  }
}
