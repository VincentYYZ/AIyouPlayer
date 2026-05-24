import { NextRequest } from "next/server";
import { createReadStream, promises as fsp } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { resolveCoverPath } from "@/app/lib/audioLib";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ segments: string[] }> }
) {
  const { segments } = await context.params;
  const abs = resolveCoverPath(segments);
  if (!abs) return new Response("forbidden", { status: 403 });

  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("not found", { status: 404 });

  const ext = path.extname(abs).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const stream = createReadStream(abs);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
