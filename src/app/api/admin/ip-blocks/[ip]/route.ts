import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { handleError, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function DELETE(_request: Request, { params }: { params: Promise<{ ip: string }> }) {
  try {
    const admin = await requireAdmin();
    const { ip } = await params;
    const decodedIp = decodeURIComponent(ip);

    const block = await prisma.iPBlock.findUnique({ where: { ipAddress: decodedIp } });
    if (block) {
      await prisma.iPBlock.delete({ where: { ipAddress: decodedIp } });
      await logAudit({ 
        userId: admin.id, 
        action: "IP_UNBLOCKED", 
        entity: "IPBlock", 
        entityId: block.id,
        details: { ip: block.ipAddress }
      });
    }

    return ok({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}
