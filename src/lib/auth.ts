import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "agentflow_session";

/**
 * Retrieves the session secret used for signing authentication cookies.
 * Falls back to a default value in local development.
 */
function secret() {
  return process.env.SESSION_SECRET || "local-development-secret";
}

/**
 * Generates a cryptographic signature for a given session value.
 */
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/**
 * Creates a secure, HTTP-only session cookie for the specified user.
 * 
 * @param {string} userId - The ID of the user to authenticate.
 */
export async function createSession(userId: string) {
  const nonce = randomBytes(12).toString("base64url");
  const value = `${userId}.${Date.now()}.${nonce}`;
  const token = `${value}.${sign(value)}`;
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.REQUIRE_HTTPS === "true",
    maxAge: 60 * 60 * 24 * 14,
    path: "/"
  });
}

/**
 * Clears the current user's session cookie, effectively logging them out.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Validates the session cookie and returns the currently authenticated user.
 * Returns null if the user is not authenticated or the session is invalid.
 */
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
      avatarUrl: true,
      role: true,
      approved: true,
      mustChangePassword: true,
      createdAt: true
    }
  });
}

/**
 * Ensures a user is authenticated and approved. 
 * Throws an UnauthorizedError if validation fails.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }
  if (!user.approved) {
    await clearSession();
    const error = new Error("Konto czeka na akceptacje admina."); // Account pending admin approval
    error.name = "UnauthorizedError";
    throw error;
  }
  return user;
}

/**
 * Ensures the authenticated user holds the ADMIN role.
 * Throws an error if the user lacks sufficient privileges.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    const error = new Error("Tylko admin moze wykonac te operacje."); // Only admins can perform this action
    error.name = "UnauthorizedError";
    throw error;
  }
  return user;
}

/**
 * Bootstraps the application by ensuring a default administrator account exists.
 * The default credentials are admin@admin.com / admin123.
 */
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
