import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

type AuditParams = {
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  details?: Record<string, any>;
};

export async function logAudit({ userId, action, entity, entityId, details }: AuditParams) {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null;
    const userAgent = headersList.get("user-agent") || null;

    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : null,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    // We don't want audit logging failures to crash the application, but we should log them to the console
    console.error("Failed to write audit log:", error);
  }
}
