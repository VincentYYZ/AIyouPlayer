import type { AudioTrack } from "@/app/lib/types";

/**
 * 在 assistant 文本中查找形如：
 *   ```tracks
 *   [...]
 *   ```
 * 的代码块，并把里面的 JSON 数组解析成 AudioTrack[]。
 *
 * 若代码块同时存在 `local` 与 `bili` 两类条目（取决于 url 是否以 /api/audio 开头），
 * 调用方需要分别处理。
 */
export interface ExtractedTracks {
  /** 文本去除 tracks 块后的纯净版本 */
  cleanedText: string;
  /** 被解析出的曲目（去重） */
  tracks: AudioTrack[];
  /** 仅 BV 来源、url 非本地的条目（需要后台转换） */
  pendingBvids: string[];
}

const FENCE_RE = /```tracks\s*\n([\s\S]*?)\n```/g;

export function extractTracksFromText(text: string): ExtractedTracks {
  const tracks: AudioTrack[] = [];
  const pendingBvids: string[] = [];
  const cleaned = text.replace(FENCE_RE, (_, body: string) => {
    try {
      const arr = JSON.parse(body) as Array<Record<string, unknown>>;
      if (!Array.isArray(arr)) return "";
      for (const item of arr) {
        const t = normalizeTrack(item);
        if (!t) continue;
        if (t.url) {
          tracks.push(t);
        } else if (t.bvid) {
          pendingBvids.push(t.bvid);
        }
      }
    } catch {
      // 忽略解析失败的块
    }
    return "";
  }).trim();

  // 去重
  const seen = new Set<string>();
  const uniq: AudioTrack[] = [];
  for (const t of tracks) {
    const key = t.id || t.url;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    uniq.push(t);
  }
  const uniqBvids = Array.from(new Set(pendingBvids));

  return { cleanedText: cleaned, tracks: uniq, pendingBvids: uniqBvids };
}

function normalizeTrack(raw: Record<string, unknown>): AudioTrack | null {
  const title = strOrUndef(raw.title);
  const url = strOrUndef(raw.url);
  const bvid = strOrUndef(raw.bvid);
  const id = strOrUndef(raw.id) ?? deriveId({ url, bvid, title });
  if (!id || !title) return null;

  const isLocal = !!url && url.startsWith("/api/audio");
  return {
    id,
    title,
    author: strOrUndef(raw.author) ?? "",
    duration: strOrUndef(raw.duration),
    ext: strOrUndef(raw.ext) ?? guessExt(url),
    url: url ?? "",
    bvid,
    source: isLocal ? "local" : bvid ? "bili" : "local",
  };
}

function strOrUndef(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

function deriveId(parts: { url?: string; bvid?: string; title?: string }): string {
  return parts.url || parts.bvid || parts.title || "";
}

function guessExt(url?: string): string {
  if (!url) return "";
  const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
  return m ? `.${m[1].toLowerCase()}` : "";
}

/**
 * 在 assistant 文本中查找：
 *   ```added
 *   [...]
 *   ```
 * 这类块由后端转码完成后注入，前端将其加入播放队列。
 */
const ADDED_FENCE_RE = /```added\s*\n([\s\S]*?)\n```/g;

export function extractAddedFromText(text: string): {
  cleanedText: string;
  tracks: AudioTrack[];
} {
  const tracks: AudioTrack[] = [];
  const cleaned = text.replace(ADDED_FENCE_RE, (_, body: string) => {
    try {
      const arr = JSON.parse(body) as Array<Record<string, unknown>>;
      for (const item of arr ?? []) {
        const t = normalizeTrack(item);
        if (t && t.url) tracks.push(t);
      }
    } catch {
      // ignore
    }
    return "";
  }).trim();

  return { cleanedText: cleaned, tracks };
}
