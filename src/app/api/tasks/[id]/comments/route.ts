import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { commentSchema } from "@/lib/validation";
import { logActivity, notifyUsers, taskInclude, usersMentionedIn } from "@/lib/tasks";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = commentSchema.parse(await request.json());
    const task = await prisma.task.findUniqueOrThrow({
      where: { id },
      include: { assignees: true }
    });

    const comment = await prisma.comment.create({
      data: { taskId: id, authorId: user.id, body: body.body }
    });
    await logActivity(id, user.id, "COMMENTED", "Dodano komentarz.");
    await logAudit({ userId: user.id, action: "COMMENT_ADD", entity: "Comment", entityId: comment.id, details: { taskId: id } });

    const mentioned = await usersMentionedIn(body.body);
    await notifyUsers({
      userIds: mentioned.map((item) => item.id),
      actorId: user.id,
      taskId: id,
      title: `Wspomniano Cie w ${task.key}`,
      body: body.body
    });
    await notifyUsers({
      userIds: task.assignees.map((item) => item.userId),
      actorId: user.id,
      taskId: id,
      title: `Nowy komentarz w ${task.key}`,
      body: body.body
    });

    const fresh = await prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    return ok({ task: fresh });
  } catch (error) {
    return handleError(error);
  }
}
