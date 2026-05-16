import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(process.cwd(), "public", "uploads", filename);
    const buffer = await readFile(filePath);
    
    // Attempt to guess content type or default to download
    const ext = filename.split(".").pop()?.toLowerCase();
    const contentType = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      txt: "text/plain",
      zip: "application/zip"
    }[ext || ""] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (error) {
    return new NextResponse("Not Found", { status: 404 });
  }
}
