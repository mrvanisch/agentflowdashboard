import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { adminPasswordResetSchema } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = adminPasswordResetSchema.parse(await request.json());

    const user = await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(body.password, 12),
        mustChangePassword: true
      },
      select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true, mustChangePassword: true, createdAt: true }
    });

    await logAudit({ userId: admin.id, action: "USER_PASSWORD_RESET", entity: "User", entityId: user.id });
    return ok({ user });
  } catch (error) {
    return handleError(error);
  }
}
