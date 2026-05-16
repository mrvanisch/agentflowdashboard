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
  
  // Find the task with the highest key number by sorting
  const lastTask = await prisma.task.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { key: true }
  });

  if (!lastTask) return `${project.key}-1`;

  // Extract the number from keys like "AFD-12"
  const parts = lastTask.key.split("-");
  const lastNumber = parseInt(parts[parts.length - 1], 10);
  
  if (isNaN(lastNumber)) {
    // Fallback to count if key format is unexpected
    const count = await prisma.task.count({ where: { projectId } });
    return `${project.key}-${count + 1}`;
  }

  return `${project.key}-${lastNumber + 1}`;
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
