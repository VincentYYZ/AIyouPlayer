import { NextRequest } from "next/server";
import { enqueueConvertJobs, getJobsSnapshot } from "@/app/lib/bili/jobs";

export const dynamic = "force-dynamic";

/** 创建一组下载/转换任务 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const bvids =
    body && typeof body === "object" && Array.isArray((body as { bvids?: unknown[] }).bvids)
      ? ((body as { bvids: unknown[] }).bvids.filter((v) => typeof v === "string") as string[])
      : [];
  if (!bvids.length) {
    return Response.json({ error: "bvids[] required" }, { status: 400 });
  }
  const jobs = enqueueConvertJobs(bvids);
  return Response.json({ jobs });
}

/** 查询任务状态：?jobId=xxx&jobId=yyy */
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.getAll("jobId");
  if (!ids.length) return Response.json({ jobs: [] });
  const jobs = getJobsSnapshot(ids);
  return Response.json({ jobs });
}
