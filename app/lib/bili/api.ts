import { BILI_API_HEADERS, buildCookie } from "@/app/lib/bili/headers";
import {
  ensureBuvid3,
  getMixinKey,
  signWbiParams,
  toQueryString,
} from "@/app/lib/bili/wbi";
import type {
  BiliDashAudio,
  BiliSearchItem,
  DanmakuItem,
} from "@/app/lib/types";

function stripHtml(s: string): string {
  return s
    .replace(/<em[^>]*>/gi, "")
    .replace(/<\/em>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/** 视频元信息（bvid -> cid + title） */
export async function getVideoInfo(bvid: string): Promise<{
  bvid: string;
  cid: string;
  title: string;
  durationSec: number;
  cover: string;
}> {
  const mixinKey = await getMixinKey();
  const buvid3 = await ensureBuvid3();
  const params = signWbiParams({ bvid }, mixinKey);
  const url = `https://api.bilibili.com/x/web-interface/wbi/view?${toQueryString(params)}`;

  const res = await fetch(url, {
    headers: { ...BILI_API_HEADERS, Cookie: buildCookie(buvid3) },
  });
  const json = (await res.json()) as {
    code?: number;
    message?: string;
    data?: { bvid?: string; cid?: number; title?: string; duration?: number; pic?: string };
  };

  if (json.code !== 0 || !json.data?.cid) {
    throw new Error(`view failed: ${json.message ?? `code ${json.code}`}`);
  }
  return {
    bvid: json.data.bvid ?? bvid,
    cid: String(json.data.cid),
    title: json.data.title ?? bvid,
    durationSec: json.data.duration ?? 0,
    cover: normalizeCover(json.data.pic ?? ""),
  };
}

/** 关键词搜索视频 */
export async function searchVideos(
  keyword: string,
  page = 1
): Promise<{ total: number; videos: BiliSearchItem[] }> {
  const mixinKey = await getMixinKey();
  const buvid3 = await ensureBuvid3();
  const params = signWbiParams(
    {
      search_type: "video",
      keyword,
      page,
      order: "totalrank",
      page_size: 30,
    },
    mixinKey
  );
  const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${toQueryString(params)}`;

  const res = await fetch(url, {
    headers: { ...BILI_API_HEADERS, Cookie: buildCookie(buvid3) },
  });
  const json = (await res.json()) as {
    code?: number;
    data?: {
      numResults?: number;
      result?: Array<{
        bvid?: string;
        title?: string;
        author?: string;
        duration?: string;
        play?: number;
        pic?: string;
      }>;
    };
  };

  if (json.code !== 0 || !json.data?.result) {
    return { total: 0, videos: [] };
  }

  const videos: BiliSearchItem[] = json.data.result
    .filter((v) => !!v.bvid)
    .map((v) => ({
      bvid: v.bvid as string,
      title: stripHtml(v.title ?? ""),
      author: v.author ?? "",
      duration: v.duration ?? "",
      play: typeof v.play === "number" ? v.play : 0,
      cover: normalizeCover(v.pic ?? ""),
    }));

  return { total: json.data.numResults ?? videos.length, videos };
}

function normalizeCover(u: string): string {
  if (!u) return "";
  if (u.startsWith("//")) return `https:${u}`;
  return u;
}

/** 获取 DASH 音频流（带 SESSDATA 时可能解锁更高码率） */
export async function getDashAudios(bvid: string, cid: string): Promise<BiliDashAudio[]> {
  const mixinKey = await getMixinKey();
  const buvid3 = await ensureBuvid3();

  const params = signWbiParams(
    { bvid, cid, fnval: 4048, fnver: 0, fourk: 1 },
    mixinKey
  );
  const url = `https://api.bilibili.com/x/player/wbi/playurl?${toQueryString(params)}`;

  const res = await fetch(url, {
    headers: { ...BILI_API_HEADERS, Cookie: buildCookie(buvid3) },
  });
  const json = (await res.json()) as {
    code?: number;
    message?: string;
    data?: {
      dash?: {
        audio?: Array<RawAudio>;
        flac?: { audio?: RawAudio | null } | null;
        dolby?: { audio?: RawAudio[] | null } | null;
      };
    };
  };

  if (json.code !== 0 || !json.data?.dash) {
    throw new Error(`playurl failed: ${json.message ?? `code ${json.code}`}`);
  }

  const collected: RawAudio[] = [];
  for (const a of json.data.dash.audio ?? []) collected.push(a);
  const flac = json.data.dash.flac?.audio;
  if (flac) collected.push(flac);
  for (const d of json.data.dash.dolby?.audio ?? []) collected.push(d);

  const list: BiliDashAudio[] = [];
  for (const a of collected) {
    const baseUrl = a.baseUrl || a.base_url;
    if (!baseUrl) continue;
    list.push({
      id: a.id ?? 0,
      baseUrl,
      backupUrls: a.backupUrl ?? a.backup_url ?? [],
      bandwidth: a.bandwidth ?? 0,
      codecs: a.codecs ?? "",
      mimeType: a.mimeType ?? a.mime_type ?? "audio/mp4",
    });
  }

  list.sort((a, b) => a.bandwidth - b.bandwidth);
  return list;
}

interface RawAudio {
  id?: number;
  base_url?: string;
  baseUrl?: string;
  backup_url?: string[];
  backupUrl?: string[];
  bandwidth?: number;
  codecs?: string;
  mime_type?: string;
  mimeType?: string;
}

/** 拉取弹幕 XML 并解析为简单结构 */
export async function getDanmaku(cid: string): Promise<DanmakuItem[]> {
  const url = `https://comment.bilibili.com/${encodeURIComponent(cid)}.xml`;
  const res = await fetch(url, { headers: BILI_API_HEADERS });
  if (!res.ok) return [];
  const buf = await res.arrayBuffer();
  // Bilibili 弹幕 XML 默认 utf-8
  const xml = new TextDecoder("utf-8").decode(buf);
  return parseDanmakuXml(xml);
}

function parseDanmakuXml(xml: string): DanmakuItem[] {
  const items: DanmakuItem[] = [];
  const re = /<d\s+p="([^"]+)">([\s\S]*?)<\/d>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const [, p, raw] = m;
    const fields = p.split(",");
    if (fields.length < 4) continue;
    const time = parseFloat(fields[0]) || 0;
    const sizeRaw = parseInt(fields[2], 10);
    const color = parseInt(fields[3], 10) || undefined;
    const text = decodeXmlEntities(raw);
    items.push({
      time,
      text,
      color,
      size: sizeRaw <= 18 ? "small" : sizeRaw >= 36 ? "large" : "normal",
    });
  }
  items.sort((a, b) => a.time - b.time);
  return items;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
