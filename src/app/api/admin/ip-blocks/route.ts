import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const blockSchema = z.object({
  ipAddress: z.string().min(1),
  reason: z.string().optional()
});

export async function GET() {
  try {
    await requireAdmin();
    const blocks = await prisma.iPBlock.findMany({
      orderBy: { createdAt: "desc" }
    });
    return ok({ blocks });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = blockSchema.parse(await request.json());
    
    const block = await prisma.iPBlock.upsert({
      where: { ipAddress: body.ipAddress },
      update: { reason: body.reason },
      create: { ipAddress: body.ipAddress, reason: body.reason }
    });

    await logAudit({ 
      userId: admin.id, 
      action: "IP_BLOCKED", 
      entity: "IPBlock", 
      entityId: block.id,
      details: { ip: block.ipAddress, reason: block.reason }
    });

    return ok({ block });
  } catch (error) {
    return handleError(error);
  }
}
