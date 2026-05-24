import { createHash } from "node:crypto";
import { BILI_API_HEADERS, buildCookie } from "@/app/lib/bili/headers";

/**
 * WBI 签名实现
 *
 * 这是 Bilibili 公开的接口签名协议（与 HTTP header 名一样属于互通契约）。
 * 步骤：
 *   1. 从 nav 接口取得 img_url / sub_url
 *   2. 取每个 URL 文件名（去后缀）拼接得到 rawKey
 *   3. 用固定的 mixin 索引表对 rawKey 重排，截取 32 字符作为 mixinKey
 *   4. 对参数按 key 字母序排序，附加 wts=当前秒，拼接 mixinKey 后 md5 得到 w_rid
 */

/** mixin 重排索引（公开协议常量） */
const MIXIN_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
  27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
];

let cachedKeys: { imgKey: string; subKey: string; expireAt: number } | null = null;
let cachedBuvid3: { value: string; expireAt: number } | null = null;

/** 从 navigation 接口取 imgKey/subKey，1 小时内复用。 */
export async function fetchWbiKeys(): Promise<{ imgKey: string; subKey: string }> {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expireAt > now) {
    return { imgKey: cachedKeys.imgKey, subKey: cachedKeys.subKey };
  }

  const buvid3 = await ensureBuvid3();
  const res = await fetch("https://api.bilibili.com/x/web-interface/nav", {
    headers: { ...BILI_API_HEADERS, Cookie: buildCookie(buvid3) },
  });
  const json = (await res.json()) as {
    code?: number;
    data?: { wbi_img?: { img_url?: string; sub_url?: string } };
  };
  const imgUrl = json.data?.wbi_img?.img_url ?? "";
  const subUrl = json.data?.wbi_img?.sub_url ?? "";
  if (!imgUrl || !subUrl) {
    throw new Error(`wbi nav failed: code=${json.code}`);
  }
  const imgKey = extractKeyFromUrl(imgUrl);
  const subKey = extractKeyFromUrl(subUrl);
  cachedKeys = { imgKey, subKey, expireAt: now + 60 * 60 * 1000 };
  return { imgKey, subKey };
}

function extractKeyFromUrl(u: string): string {
  const last = u.split("/").pop() ?? "";
  return last.split(".")[0] ?? "";
}

/** 由 imgKey + subKey 派生 mixinKey */
export function deriveMixinKey(imgKey: string, subKey: string): string {
  const raw = `${imgKey}${subKey}`;
  let out = "";
  for (const idx of MIXIN_TABLE) {
    if (idx < raw.length) out += raw[idx];
  }
  return out.slice(0, 32);
}

/** 给参数加上 wts 与 w_rid 字段。 */
export function signWbiParams(
  params: Record<string, string | number>,
  mixinKey: string
): Record<string, string> {
  const wts = Math.floor(Date.now() / 1000);
  const merged: Record<string, string> = { wts: String(wts) };
  for (const [k, v] of Object.entries(params)) merged[k] = String(v);

  // 过滤值中可能干扰签名的字符
  for (const k of Object.keys(merged)) {
    merged[k] = merged[k].replace(/[!'()*]/g, "");
  }

  const sortedKeys = Object.keys(merged).sort();
  const queryStr = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(merged[k])}`)
    .join("&");

  const wRid = createHash("md5").update(queryStr + mixinKey).digest("hex");
  merged.w_rid = wRid;
  return merged;
}

/** 一次拿到 mixinKey，方便上层使用。 */
export async function getMixinKey(): Promise<string> {
  const { imgKey, subKey } = await fetchWbiKeys();
  return deriveMixinKey(imgKey, subKey);
}

/** 拉取一次 buvid3 cookie 并缓存（B站部分接口需要）。 */
export async function ensureBuvid3(): Promise<string> {
  const now = Date.now();
  if (cachedBuvid3 && cachedBuvid3.expireAt > now) return cachedBuvid3.value;
  try {
    const res = await fetch("https://www.bilibili.com/", {
      headers: BILI_API_HEADERS,
      redirect: "follow",
    });
    const setCookie = res.headers.get("set-cookie") ?? "";
    const m = setCookie.match(/buvid3=([^;,\s]+)/);
    const value = m?.[1] ?? randomBuvid();
    cachedBuvid3 = { value, expireAt: now + 60 * 60 * 1000 };
    return value;
  } catch {
    const value = randomBuvid();
    cachedBuvid3 = { value, expireAt: now + 10 * 60 * 1000 };
    return value;
  }
}

function randomBuvid(): string {
  const rnd = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
  return `${rnd.toUpperCase()}infoc`;
}

/** 把参数对象组装成查询串。 */
export function toQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}
