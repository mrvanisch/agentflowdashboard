import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { taskLinkSchema } from "@/lib/validation";
import { logActivity, notifyUsers, taskInclude } from "@/lib/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = taskLinkSchema.parse(await request.json());
    const task = await prisma.task.findUniqueOrThrow({
      where: { id },
      include: { assignees: true }
    });

    await prisma.taskLink.create({
      data: {
        taskId: id,
        authorId: user.id,
        title: body.title,
        url: body.url
      }
    });
    await logActivity(id, user.id, "LINKED", `Dodano link ${body.title}.`);
    await notifyUsers({
      userIds: task.assignees.map((item) => item.userId),
      actorId: user.id,
      taskId: id,
      title: `Nowy link w ${task.key}`,
      body: body.title
    });

    const fresh = await prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
    return ok({ task: fresh });
  } catch (error) {
    return handleError(error);
  }
}
