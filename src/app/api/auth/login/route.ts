import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { fail, handleError, ok } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { isIpBlocked } from "@/lib/ip-block";

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    
    if (await isIpBlocked(ip)) {
      await logAudit({ action: "LOGIN_REJECTED", entity: "User", details: { ip, reason: "IP is blocked" } });
      return fail("Dostep zablokowany ze wzgledow bezpieczenstwa.", 403);
    }

    if (!checkRateLimit(ip, 10, 60 * 1000)) {
      await logAudit({ action: "RATE_LIMIT_EXCEEDED", entity: "User", details: { ip, endpoint: "/api/auth/login" } });
      return fail("Zbyt wiele prob logowania. Sprobuj ponownie za chwile.", 429);
    }

    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    
    if (!user) {
      await logAudit({ action: "LOGIN_FAILED", entity: "User", details: { email: body.email, reason: "User not found" } });
      return fail("Nieprawidlowy email albo haslo.", 401);
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      await logAudit({ userId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id, details: { reason: "Invalid password" } });
      return fail("Nieprawidlowy email albo haslo.", 401);
    }
    
    if (!user.approved) {
      await logAudit({ userId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id, details: { reason: "Not approved" } });
      return fail("Konto czeka na akceptacje admina.", 403);
    }

    await createSession(user.id);
    await logAudit({ userId: user.id, action: "LOGIN_SUCCESS", entity: "User", entityId: user.id });
    
    return ok({
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        role: user.role,
        approved: user.approved,
        mustChangePassword: user.mustChangePassword
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
