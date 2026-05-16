import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logActivity, notifyUsers, statusLabel, taskInclude, usersMentionedIn } from "@/lib/tasks";
import { taskUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const task = await prisma.task.findFirstOrThrow({
      where: {
        OR: [{ id }, { key: id.toUpperCase() }]
      },
      include: taskInclude
    });

    return ok({ task });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = taskUpdateSchema.parse(await request.json());
    const previous = await prisma.task.findUniqueOrThrow({
      where: { id },
      include: { assignees: true }
    });

    const nextAssignees = body.assigneeIds;
    await prisma.task.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: body.status,
        dueDate: body.dueDate === undefined ? undefined : body.dueDate ? new Date(body.dueDate) : null
      }
    });

    await logAudit({ userId: user.id, action: "TASK_UPDATE", entity: "Task", entityId: id });

    if (nextAssignees) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      if (nextAssignees.length) {
        await prisma.taskAssignee.createMany({
          data: nextAssignees.map((userId) => ({ taskId: id, userId }))
        });
      }
    }

    if (body.status && body.status !== previous.status) {
      await logActivity(id, user.id, "STATUS_CHANGED", `Status zmieniony z ${statusLabel(previous.status)} na ${statusLabel(body.status)}.`);
    } else {
      await logActivity(id, user.id, "UPDATED", "Zaktualizowano zadanie.");
    }

    if (nextAssignees) {
      const previousIds = new Set(previous.assignees.map((item) => item.userId));
      const addedIds = nextAssignees.filter((userId) => !previousIds.has(userId));
      await notifyUsers({
        userIds: addedIds,
        actorId: user.id,
        taskId: id,
        title: "Przypisano Cie do zadania",
        body: previous.title
      });
    }

    const mentioned = await usersMentionedIn(`${body.title || ""} ${body.description || ""}`);
    await notifyUsers({
      userIds: mentioned.map((item) => item.id),
      actorId: user.id,
      taskId: id,
      title: `Wspomniano Cie w ${previous.key}`,
      body: body.title || previous.title
    });

    const task = await prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    return ok({ task });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const task = await prisma.task.findUniqueOrThrow({
      where: { id },
      include: { attachments: true }
    });

    await logAudit({ userId: user.id, action: "TASK_DELETE", entity: "Task", entityId: id, details: { key: task.key, title: task.title } });
    await prisma.notification.deleteMany({ where: { taskId: id } });
    await prisma.task.delete({ where: { id } });

    await Promise.allSettled(
      task.attachments
        .filter((attachment) => attachment.url.startsWith("/uploads/"))
        .map((attachment) => unlink(path.join(process.cwd(), "public", attachment.url)))
    );

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
