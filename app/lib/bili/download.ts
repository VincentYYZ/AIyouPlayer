import { spawn } from "node:child_process";
import { createWriteStream, promises as fsp } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { BILI_API_HEADERS, BILI_STREAM_HEADERS } from "@/app/lib/bili/headers";
import { getDashAudios } from "@/app/lib/bili/api";
import { getDownloadTimeoutMs, getFfmpegBin } from "@/app/lib/env";

export interface DownloadResult {
  filePath: string;
  fileName: string;
  ext: ".mp3" | ".m4a";
  size: number;
  bandwidth: number;
  coverFileName?: string;
}

const COVER_EXT_BY_TYPE: Record<string, ".jpg" | ".png" | ".webp" | ".avif"> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

/** 流式拉取一个 URL 写入磁盘，返回字节数。 */
async function streamToFile(url: string, dest: string): Promise<number> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), getDownloadTimeoutMs());

  try {
    const res = await fetch(url, {
      headers: BILI_STREAM_HEADERS,
      signal: ac.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    // Web ReadableStream -> Node Readable
    const nodeReadable = Readable.fromWeb(
      res.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>
    );

    const out = createWriteStream(dest);
    await pipeline(nodeReadable, out);

    const stat = await fsp.stat(dest);
    return stat.size;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadCover(url: string, dir: string, baseName: string): Promise<string | undefined> {
  if (!url) return undefined;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), getDownloadTimeoutMs());
  try {
    const res = await fetch(url, {
      headers: BILI_API_HEADERS,
      signal: ac.signal,
    });
    if (!res.ok || !res.body) return undefined;

    const rawType = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext =
      COVER_EXT_BY_TYPE[rawType] ??
      (() => {
        try {
          const pathname = new URL(url).pathname.toLowerCase();
          const guessed = path.extname(pathname);
          if (guessed === ".jpeg") return ".jpg";
          if (guessed === ".jpg" || guessed === ".png" || guessed === ".webp" || guessed === ".avif") {
            return guessed as ".jpg" | ".png" | ".webp" | ".avif";
          }
        } catch {
        }
        return ".jpg";
      })();

    const fileName = `${baseName}${ext}`;
    const dest = path.join(dir, fileName);
    const nodeReadable = Readable.fromWeb(
      res.body as unknown as import("node:stream/web").ReadableStream<Uint8Array>
    );
    const out = createWriteStream(dest);
    await pipeline(nodeReadable, out);
    return fileName;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** 顺序尝试主备 URL。 */
async function downloadWithFallback(urls: string[], dest: string): Promise<number> {
  let lastErr: unknown;
  for (const u of urls) {
    try {
      return await streamToFile(u, dest);
    } catch (err) {
      lastErr = err;
      // 失败时清理半成品
      await fsp.unlink(dest).catch(() => {});
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("all CDN candidates failed");
}

/** 探测系统是否能调用 ffmpeg。 */
let ffmpegReady: boolean | null = null;
export async function hasFfmpeg(): Promise<boolean> {
  if (ffmpegReady !== null) return ffmpegReady;
  ffmpegReady = await new Promise<boolean>((resolve) => {
    const child = spawn(getFfmpegBin(), ["-version"], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
  return ffmpegReady;
}

/** 用 ffmpeg 把任意音频转成 320k MP3。 */
async function transcodeMp3(input: string, output: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      getFfmpegBin(),
      [
        "-hide_banner",
        "-loglevel", "error",
        "-y",
        "-i", input,
        "-vn",
        "-c:a", "libmp3lame",
        "-b:a", "320k",
        output,
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    child.stderr.on("data", (b) => {
      stderr += b.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
    });
  });
}

/**
 * 下载某 BV 视频的最佳音频流到指定目录。
 * - 有 ffmpeg：转 320k MP3
 * - 无 ffmpeg：直接保留 m4a
 */
export async function downloadAudio(opts: {
  bvid: string;
  cid: string;
  dir: string;
  baseName: string;
  coverUrl?: string;
}): Promise<DownloadResult> {
  const { bvid, cid, dir, baseName, coverUrl } = opts;

  const streams = await getDashAudios(bvid, cid);
  if (streams.length === 0) {
    throw new Error(`no audio stream available for ${bvid}`);
  }

  // 选最高码率
  const best = streams[streams.length - 1];
  const candidates = [best.baseUrl, ...best.backupUrls];

  await fsp.mkdir(dir, { recursive: true });
  const coverFileName = coverUrl ? await downloadCover(coverUrl, dir, baseName) : undefined;
  const tmp = path.join(dir, `${baseName}.part.m4s`);
  const size = await downloadWithFallback(candidates, tmp);

  const usable = await hasFfmpeg();
  if (usable) {
    const mp3 = path.join(dir, `${baseName}.mp3`);
    try {
      await transcodeMp3(tmp, mp3);
    } catch (err) {
      await fsp.unlink(tmp).catch(() => {});
      throw err;
    }
    await fsp.unlink(tmp).catch(() => {});
    const stat = await fsp.stat(mp3);
    return {
      filePath: mp3,
      fileName: `${baseName}.mp3`,
      ext: ".mp3",
      size: stat.size,
      bandwidth: best.bandwidth,
      coverFileName,
    };
  }

  const m4a = path.join(dir, `${baseName}.m4a`);
  await fsp.rename(tmp, m4a);
  return {
    filePath: m4a,
    fileName: `${baseName}.m4a`,
    ext: ".m4a",
    size,
    bandwidth: best.bandwidth,
    coverFileName,
  };
}
