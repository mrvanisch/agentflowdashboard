import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";

export async function GET() {
  try {
    await requireAdmin();
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true, mustChangePassword: true }
        }
      }
    });
    return ok({ logs });
  } catch (error) {
    return handleError(error);
  }
}
