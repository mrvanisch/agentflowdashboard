import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const user = await prisma.user.update({
      where: { id },
      data: { approved: true },
      select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true, mustChangePassword: true, createdAt: true }
    });

    await logAudit({ userId: admin.id, action: "USER_APPROVE", entity: "User", entityId: user.id });

    await prisma.notification.create({
      data: {
        userId: user.id,
        actorId: admin.id,
        title: "Konto zaakceptowane",
        body: "Mozesz sie teraz zalogowac do AgentFlowDashboard."
      }
    });

    return ok({ user });
  } catch (error) {
    return handleError(error);
  }
}
