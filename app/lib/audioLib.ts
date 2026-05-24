import { createHash } from "node:crypto";
import { promises as fsp } from "node:fs";
import path from "node:path";
import { getAudioLibDir } from "@/app/lib/env";
import type { AudioTrack } from "@/app/lib/types";

const SUPPORTED_EXTS = new Set([".mp3", ".m4a", ".aac", ".ogg", ".wav", ".flac"]);
const COVER_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".avif"] as const;

/** 把任意字符串规整成可作文件名的安全字符串（保留中英数字与少量符号）。 */
export function sanitizeForFileName(input: string, max = 80): string {
  const cleaned = input
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "untitled";
  return cleaned.length > max ? cleaned.slice(0, max).trim() : cleaned;
}

/** 给定目录已有文件名，找到一个不冲突的 baseName（不含扩展名）。 */
export function pickAvailableBaseName(existing: string[], desired: string): string {
  const lowerSet = new Set(existing.map((s) => s.toLowerCase()));
  const stripped = stripKnownExt(desired);
  if (!hasCollision(lowerSet, stripped)) return stripped;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stripped} (${i})`;
    if (!hasCollision(lowerSet, candidate)) return candidate;
  }
  return `${stripped}_${Date.now()}`;
}

function hasCollision(lowerSet: Set<string>, base: string): boolean {
  const baseLow = base.toLowerCase();
  for (const ext of SUPPORTED_EXTS) {
    if (lowerSet.has(`${baseLow}${ext}`)) return true;
  }
  return false;
}

function stripKnownExt(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (SUPPORTED_EXTS.has(ext)) return name.slice(0, -ext.length);
  return name;
}

/** 判断文件名是否为我们支持的音频。 */
export function isSupportedAudio(name: string): boolean {
  return SUPPORTED_EXTS.has(path.extname(name).toLowerCase());
}

/** 从文件名解析 metadata：尝试 "Title - Author"、"Author - Title"、"_BVxxxxxx" 后缀。 */
export function parseFromFileName(filename: string): { title: string; author: string; bvid?: string } {
  const base = stripKnownExt(filename);
  // 抽取末尾 _BVxxxxxx
  let bvid: string | undefined;
  const bvMatch = base.match(/_(BV[0-9A-Za-z]{10})$/);
  let core = base;
  if (bvMatch) {
    bvid = bvMatch[1];
    core = base.slice(0, bvMatch.index).trim();
  }

  // 形式：Title - Author 或 Author - Title
  const parts = core.split(" - ").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { title: parts.slice(0, -1).join(" - "), author: parts.at(-1) ?? "", bvid };
  }

  return { title: core || base, author: "", bvid };
}

/** 给定相对子目录与文件名，构造可访问的 audio URL。 */
export function buildAudioUrl(subDir: string, fileName: string): string {
  const safeSub = subDir.split(path.sep).map(encodeURIComponent).join("/");
  return `/api/audio/${safeSub ? `${safeSub}/` : ""}${encodeURIComponent(fileName)}`;
}

export function buildCoverUrl(subDir: string, fileName: string): string {
  const safeSub = subDir.split(path.sep).map(encodeURIComponent).join("/");
  return `/api/cover/${safeSub ? `${safeSub}/` : ""}${encodeURIComponent(fileName)}`;
}

export async function findAdjacentCoverFile(subDir: string, fileName: string): Promise<string | undefined> {
  const root = getAudioLibDir();
  const dir = path.join(root, subDir);
  const base = stripKnownExt(fileName);
  for (const ext of COVER_EXTS) {
    const candidate = `${base}${ext}`;
    try {
      const stat = await fsp.stat(path.join(dir, candidate));
      if (stat.isFile()) return candidate;
    } catch {
    }
  }
  return undefined;
}

/** 从绝对路径派生稳定 ID。 */
export function deriveTrackId(absPath: string): string {
  return createHash("sha1").update(absPath).digest("hex").slice(0, 16);
}

/** 把一个文件解析成 AudioTrack。 */
export async function readTrack(subDir: string, fileName: string): Promise<AudioTrack | null> {
  if (!isSupportedAudio(fileName)) return null;
  const root = getAudioLibDir();
  const abs = path.join(root, subDir, fileName);
  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;

  const meta = parseFromFileName(fileName);
  const ext = path.extname(fileName).toLowerCase();
  const coverFile = await findAdjacentCoverFile(subDir, fileName);

  return {
    id: deriveTrackId(abs),
    title: meta.title,
    author: meta.author,
    bvid: meta.bvid,
    cover: coverFile ? buildCoverUrl(subDir, coverFile) : undefined,
    ext,
    url: buildAudioUrl(subDir, fileName),
    dir: subDir,
    size: stat.size,
    source: meta.bvid ? "bili" : "local",
    addedAt: subDir.match(/^\d{4}-\d{2}-\d{2}/)?.[0],
  };
}

/** 列出目录下所有曲目（递归一层子目录）。 */
export async function scanAudioLib(): Promise<AudioTrack[]> {
  const root = getAudioLibDir();
  await fsp.mkdir(root, { recursive: true });

  const out: AudioTrack[] = [];
  const topEntries = await fsp.readdir(root, { withFileTypes: true });

  for (const entry of topEntries) {
    if (entry.isFile()) {
      const t = await readTrack("", entry.name);
      if (t) out.push(t);
    } else if (entry.isDirectory()) {
      const sub = entry.name;
      const subEntries = await fsp.readdir(path.join(root, sub), { withFileTypes: true });
      for (const sf of subEntries) {
        if (!sf.isFile()) continue;
        const t = await readTrack(sub, sf.name);
        if (t) out.push(t);
      }
    }
  }

  out.sort((a, b) => (a.dir ?? "").localeCompare(b.dir ?? "") || a.title.localeCompare(b.title));
  return out;
}

/** 关键词模糊检索（title/author/filename 命中任一即可）。 */
export function searchTracks(tracks: AudioTrack[], q: string, limit = 30): AudioTrack[] {
  const query = q.trim().toLowerCase();
  if (!query) return tracks.slice(0, limit);
  const result: AudioTrack[] = [];
  for (const t of tracks) {
    const hay = `${t.title} ${t.author ?? ""} ${path.basename(decodeURIComponent(t.url))}`.toLowerCase();
    if (hay.includes(query)) result.push(t);
    if (result.length >= limit) break;
  }
  return result;
}

/** 把一个绝对路径映射回 audio URL（若不在库内返回 null）。 */
export function audioPathToUrl(absPath: string): string | null {
  const root = getAudioLibDir();
  const rel = path.relative(root, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const segs = rel.split(path.sep);
  const fileName = segs.pop()!;
  const subDir = segs.join("/");
  return buildAudioUrl(subDir, fileName);
}

/** 解析 audio URL 回到磁盘绝对路径（带越界保护）。 */
export function resolveAudioPath(segments: string[]): string | null {
  const root = getAudioLibDir();
  const decoded = segments.map((s) => decodeURIComponent(s));
  const abs = path.resolve(root, ...decoded);
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

export function resolveCoverPath(segments: string[]): string | null {
  const abs = resolveAudioPath(segments);
  if (!abs) return null;
  const ext = path.extname(abs).toLowerCase();
  if (!COVER_EXTS.includes(ext as (typeof COVER_EXTS)[number])) return null;
  return abs;
}
