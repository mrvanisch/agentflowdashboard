import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const REGISTRATION_TOKEN_KEY = "REGISTRATION_TOKEN";

export async function getRegistrationToken() {
  const existing = await prisma.appSetting.findUnique({ where: { key: REGISTRATION_TOKEN_KEY } });
  return existing?.value || null;
}

export async function generateRegistrationToken() {
  const value = randomBytes(18).toString("base64url");
  await prisma.appSetting.upsert({
    where: { key: REGISTRATION_TOKEN_KEY },
    update: { value },
    create: { key: REGISTRATION_TOKEN_KEY, value }
  });
  console.log(`[AgentFlowDashboard] Wygenerowano nowy token rejestracji: ${value}`);
  return value;
}

export async function deleteRegistrationToken() {
  const existing = await prisma.appSetting.findUnique({ where: { key: REGISTRATION_TOKEN_KEY } });
  if (existing) {
    await prisma.appSetting.delete({ where: { key: REGISTRATION_TOKEN_KEY } });
  }
}

export async function ensureRegistrationToken() {
  const token = await getRegistrationToken();
  if (token) return token;

  const usersCount = await prisma.user.count();
  if (usersCount === 0) {
    // Only auto-generate if there are no users at all, so the first admin can register.
    const newToken = await generateRegistrationToken();
    return newToken;
  }
  
  return null;
}

export async function validateRegistrationToken(token: string) {
  const expected = await getRegistrationToken();
  if (!expected) return false;
  return token === expected;
}
