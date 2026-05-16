import { prisma } from "@/lib/prisma";

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip || ip === "unknown") return false;
  
  const block = await prisma.iPBlock.findUnique({
    where: { ipAddress: ip }
  });
  
  return !!block;
}
