import { NextRequest } from "next/server";
import { getDanmaku, getVideoInfo } from "@/app/lib/bili/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cidParam = req.nextUrl.searchParams.get("cid")?.trim();
  const bvid = req.nextUrl.searchParams.get("bvid")?.trim();
  try {
    let cid = cidParam;
    if (!cid && bvid) {
      const info = await getVideoInfo(bvid);
      cid = info.cid;
    }
    if (!cid) {
      return Response.json(
        { error: "cid or bvid is required", items: [] },
        { status: 400 }
      );
    }
    const items = await getDanmaku(cid);
    return Response.json({ cid, total: items.length, items });
  } catch (err) {
    return Response.json(
      { error: String(err), items: [] },
      { status: 502 }
    );
  }
}
