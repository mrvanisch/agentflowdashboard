import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { validateRegistrationToken } from "@/lib/registration-token";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { isIpBlocked } from "@/lib/ip-block";

const colors = ["#2563eb", "#059669", "#dc2626", "#7c3aed", "#ea580c", "#0891b2"];

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";

    if (await isIpBlocked(ip)) {
      await logAudit({ action: "REGISTER_REJECTED", entity: "User", details: { ip, reason: "IP is blocked" } });
      return fail("Dostep zablokowany ze wzgledow bezpieczenstwa.", 403);
    }
    
    if (!checkRateLimit(ip, 5, 60 * 1000)) {
      await logAudit({ action: "RATE_LIMIT_EXCEEDED", entity: "User", details: { ip, endpoint: "/api/auth/register" } });
      return fail("Zbyt wiele prob rejestracji. Sprobuj ponownie za chwile.", 429);
    }

    const body = registerSchema.parse(await request.json());
    const validToken = await validateRegistrationToken(body.token);
    if (!validToken) {
      await logAudit({ action: "REGISTER_FAILED", details: { reason: "Invalid token", email: body.email } });
      return fail("Nieprawidlowy token rejestracji.", 403);
    }

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: body.email }, { username: body.username }] }
    });
    if (exists) {
      await logAudit({ action: "REGISTER_FAILED", details: { reason: "Email or username taken", email: body.email } });
      return fail("Email albo nazwa uzytkownika jest juz zajeta.", 409);
    }

    const userCount = await prisma.user.count();
    const firstUser = userCount === 0;
    const user = await prisma.user.create({
      data: {
        name: body.name,
        username: body.username,
        email: body.email,
        passwordHash: await bcrypt.hash(body.password, 12),
        avatarColor: colors[Math.floor(Math.random() * colors.length)],
        role: firstUser ? "ADMIN" : "MEMBER",
        approved: firstUser
      },
      select: { id: true, name: true, username: true, email: true, avatarColor: true, role: true, approved: true }
    });

    await logAudit({ userId: user.id, action: "REGISTER_SUCCESS", entity: "User", entityId: user.id });

    if (firstUser) {
      await createSession(user.id);
      return ok({ user, pendingApproval: false });
    }

    const admins = await prisma.user.findMany({ where: { role: "ADMIN", approved: true }, select: { id: true } });
    if (admins.length) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          actorId: user.id,
          title: "Nowy uzytkownik czeka na akceptacje",
          body: `${user.name} (@${user.username})`
        }))
      });
    }

    return ok({ user, pendingApproval: true });
  } catch (error) {
    return handleError(error);
  }
}
