import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_.-]+$/).transform((v) => v.toLowerCase()),
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(6),
  token: z.string().min(12)
});

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  password: z.string().min(1)
});

export const taskCreateSchema = z.object({
  title: z.string().min(3),
  description: z.string().default(""),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE", "BLOCKED"]).default("TODO"),
  dueDate: z.string().optional().nullable(),
  assigneeIds: z.array(z.string()).default([])
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  id: z.string().optional()
});

export const commentSchema = z.object({
  body: z.string().min(1)
});

export const taskLinkSchema = z.object({
  title: z.string().min(2),
  url: z.string().url()
});

export const adminUserUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  approved: z.boolean().optional(),
  mustChangePassword: z.boolean().optional()
});

export const adminPasswordResetSchema = z.object({
  password: z.string().min(6)
});
