import { NextRequest } from "next/server";
import { createReadStream, promises as fsp } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { resolveAudioPath } from "@/app/lib/audioLib";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac",
};

/**
 * 简单的音频静态文件服务，支持 HTTP Range（流式 / 断点续播）。
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ segments: string[] }> }
) {
  const { segments } = await context.params;
  const abs = resolveAudioPath(segments);
  if (!abs) return new Response("forbidden", { status: 403 });

  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    return new Response("not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("not found", { status: 404 });

  const total = stat.size;
  const ext = path.extname(abs).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/bytes=(\d+)-(\d+)?/);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
      if (Number.isFinite(start) && start <= end && start >= 0) {
        const stream = createReadStream(abs, { start, end });
        const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
        return new Response(webStream, {
          status: 206,
          headers: {
            "Content-Type": mime,
            "Content-Length": String(end - start + 1),
            "Content-Range": `bytes ${start}-${end}/${total}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
          },
        });
      }
    }
  }

  const stream = createReadStream(abs);
  const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(total),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
  });
}
