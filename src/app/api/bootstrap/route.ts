import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { ensureDefaultProject, taskInclude } from "@/lib/tasks";

export async function GET() {
  try {
    const user = await requireUser();
    await ensureDefaultProject(user.id);

    const [projects, users, tasks, notifications] = await Promise.all([
      prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.user.findMany({
        select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true, mustChangePassword: true, createdAt: true },
        orderBy: { name: "asc" }
      }),
      prisma.task.findMany({ include: taskInclude, orderBy: { updatedAt: "desc" } }),
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30
      })
    ]);

    return ok({ user, projects, users, tasks, notifications });
  } catch (error) {
    return handleError(error);
  }
}
