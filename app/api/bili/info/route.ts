import { NextRequest } from "next/server";
import { getVideoInfo } from "@/app/lib/bili/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const bvid = (req.nextUrl.searchParams.get("bvid") ?? "").trim();
  if (!bvid) {
    return Response.json({ error: "bvid is required" }, { status: 400 });
  }
  try {
    const info = await getVideoInfo(bvid);
    return Response.json(info);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
