import { getBiliSessdata } from "@/app/lib/env";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 标准 web 接口请求头 */
export const BILI_API_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Origin: "https://www.bilibili.com",
  Referer: "https://www.bilibili.com/",
};

/** CDN 流媒体专用：必须带 Referer/Origin，否则 403 */
export const BILI_STREAM_HEADERS: Record<string, string> = {
  "User-Agent": UA,
  Accept: "*/*",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  Origin: "https://www.bilibili.com",
  Referer: "https://www.bilibili.com/",
};

/** 拼接 cookie：包含 SESSDATA（如配置）与 buvid3。 */
export function buildCookie(buvid3: string): string {
  const sessdata = getBiliSessdata();
  const parts: string[] = [];
  if (buvid3) parts.push(`buvid3=${buvid3}`);
  if (sessdata) parts.push(`SESSDATA=${sessdata}`);
  return parts.join("; ");
}
