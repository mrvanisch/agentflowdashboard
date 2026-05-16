import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { ensureDefaultProject, logActivity, nextTaskKey, notifyUsers, taskInclude, usersMentionedIn } from "@/lib/tasks";
import { taskCreateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

function isTaskKeyCollision(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = (error.meta as { target?: string[] | string } | undefined)?.target;
  return target === "key" || (Array.isArray(target) && target.includes("key"));
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const project = await ensureDefaultProject(user.id);
    const body = taskCreateSchema.parse(await request.json());

    let task: Prisma.TaskGetPayload<{ include: typeof taskInclude }> | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const key = await nextTaskKey(project.id);
      try {
        task = await prisma.task.create({
          data: {
            key,
            title: body.title,
            description: body.description,
            priority: body.priority,
            status: body.status,
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
            projectId: project.id,
            reporterId: user.id,
            assignees: {
              create: body.assigneeIds.map((userId) => ({ userId }))
            }
          },
          include: taskInclude
        });
        break;
      } catch (error) {
        if (attempt < 2 && isTaskKeyCollision(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!task) throw new Error("Nie udalo sie wygenerowac numeru taska.");

    await logActivity(task.id, user.id, "CREATED", `Utworzono zadanie ${task.key}.`);
    await logAudit({ userId: user.id, action: "TASK_CREATE", entity: "Task", entityId: task.id, details: { key: task.key, title: task.title } });

    if (body.assigneeIds.length) {
      await logActivity(task.id, user.id, "ASSIGNED", "Przypisano osoby do zadania.");
      await notifyUsers({
        userIds: body.assigneeIds,
        actorId: user.id,
        taskId: task.id,
        title: `Przypisano Cie do ${task.key}`,
        body: task.title
      });
    }

    const mentioned = await usersMentionedIn(`${body.title} ${body.description}`);
    await notifyUsers({
      userIds: mentioned.map((item) => item.id),
      actorId: user.id,
      taskId: task.id,
      title: `Wspomniano Cie w ${task.key}`,
      body: task.title
    });

    const fresh = await prisma.task.findUniqueOrThrow({ where: { id: task.id }, include: taskInclude });
    return ok({ task: fresh });
  } catch (error) {
    return handleError(error);
  }
}
