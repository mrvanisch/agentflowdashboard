import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const REGISTRATION_TOKEN_KEY = "REGISTRATION_TOKEN";

export async function ensureRegistrationToken() {
  const existing = await prisma.appSetting.findUnique({ where: { key: REGISTRATION_TOKEN_KEY } });
  if (existing) {
    console.log(`[AgentFlowDashboard] Token rejestracji: ${existing.value}`);
    return existing.value;
  }

  const value = randomBytes(18).toString("base64url");
  await prisma.appSetting.create({
    data: { key: REGISTRATION_TOKEN_KEY, value }
  });
  console.log(`[AgentFlowDashboard] Wygenerowano token rejestracji: ${value}`);
  return value;
}

export async function validateRegistrationToken(token: string) {
  const expected = await ensureRegistrationToken();
  return token === expected;
}
