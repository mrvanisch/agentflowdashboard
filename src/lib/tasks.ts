import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const taskInclude = {
  project: true,
  reporter: {
      select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true }
  },
  assignees: {
    include: {
      user: {
        select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true }
      }
    }
  },
  comments: {
    include: {
      author: {
        select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true }
      }
    },
    orderBy: { createdAt: "asc" as const }
  },
  attachments: {
    include: {
      uploadedBy: {
        select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true }
      }
    },
    orderBy: { createdAt: "desc" as const }
  },
  links: {
    include: {
      author: {
        select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true }
      }
    },
    orderBy: { createdAt: "desc" as const }
  },
  activities: {
    include: {
      actor: {
        select: { id: true, name: true, username: true, email: true, avatarColor: true, avatarUrl: true, role: true, approved: true }
      }
    },
    orderBy: { createdAt: "desc" as const }
  }
} satisfies Prisma.TaskInclude;

export async function ensureDefaultProject(userId: string) {
  const existing = await prisma.project.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.project.create({
    data: {
      name: "AgentFlowDashboard",
      key: "AFD",
      description: "Glowny projekt zespolu",
      ownerId: userId
    }
  });
}

export async function nextTaskKey(projectId: string) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const existingKeys = await prisma.task.findMany({
    where: { projectId, key: { startsWith: `${project.key}-` } },
    select: { key: true }
  });

  const highestNumber = existingKeys.reduce((highest, task) => {
    const suffix = task.key.slice(project.key.length + 1);
    const number = Number.parseInt(suffix, 10);
    return Number.isFinite(number) && `${number}` === suffix ? Math.max(highest, number) : highest;
  }, 0);

  return `${project.key}-${highestNumber + 1}`;
}

export type ActivityAction = "CREATED" | "UPDATED" | "STATUS_CHANGED" | "ASSIGNED" | "COMMENTED" | "ATTACHED" | "LINKED" | "MENTIONED";
export type TaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE" | "BLOCKED";

export async function logActivity(taskId: string, actorId: string, action: ActivityAction, message: string) {
  return prisma.activity.create({
    data: { taskId, actorId, action, message }
  });
}

export async function notifyUsers(params: {
  userIds: string[];
  actorId: string;
  taskId?: string;
  title: string;
  body: string;
}) {
  const recipients = [...new Set(params.userIds)].filter((id) => id !== params.actorId);
  if (!recipients.length) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorId: params.actorId,
      taskId: params.taskId,
      title: params.title,
      body: params.body
    }))
  });
}

export async function usersMentionedIn(body: string) {
  const usernames = [...body.matchAll(/@([a-zA-Z0-9_.-]+)/g)].map((match) => match[1].toLowerCase());
  if (!usernames.length) return [];

  return prisma.user.findMany({
    where: { username: { in: [...new Set(usernames)] } },
    select: { id: true }
  });
}

export function statusLabel(status: string) {
  return {
    BACKLOG: "Backlog",
    TODO: "Do zrobienia",
    IN_PROGRESS: "W toku",
    REVIEW: "Review",
    DONE: "Gotowe",
    BLOCKED: "Zablokowane"
  }[status as TaskStatus] || status;
}
