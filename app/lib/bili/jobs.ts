import { promises as fsp } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  pickAvailableBaseName,
  readTrack,
  sanitizeForFileName,
} from "@/app/lib/audioLib";
import { downloadAudio } from "@/app/lib/bili/download";
import { getVideoInfo } from "@/app/lib/bili/api";
import { getAudioLibDir, getConvertConcurrency } from "@/app/lib/env";
import type { ConvertJob } from "@/app/lib/types";

/**
 * 进程内任务队列：
 * - jobs: id -> ConvertJob 全量状态
 * - 一个 active 计数器控制并发
 * - 通过 scheduleDrain() 触发下一批
 *
 * 注意：服务重启会丢失任务状态。这是一个轻量实现，与项目定位一致。
 */

const jobs = new Map<string, ConvertJob>();
const queue: string[] = [];
let active = 0;
let draining = false;

function nowMs(): number {
  return Date.now();
}

function scheduleDrain(): void {
  if (draining) return;
  draining = true;
  setImmediate(() => {
    draining = false;
    drain();
  });
}

function drain(): void {
  const cap = getConvertConcurrency();
  while (active < cap && queue.length > 0) {
    const id = queue.shift()!;
    const job = jobs.get(id);
    if (!job) continue;
    if (job.status !== "queued") continue;
    active += 1;
    void runJob(id).finally(() => {
      active = Math.max(0, active - 1);
      scheduleDrain();
    });
  }
}

async function runJob(id: string): Promise<void> {
  const initial = jobs.get(id);
  if (!initial) return;

  jobs.set(id, { ...initial, status: "running", updatedAt: nowMs() });

  try {
    const info = await getVideoInfo(initial.bvid);
    const dateDir = new Date().toISOString().slice(0, 10);
    const root = getAudioLibDir();
    const dir = path.join(root, dateDir);
    await fsp.mkdir(dir, { recursive: true });

    const niceTitle = sanitizeForFileName(info.title || initial.bvid);
    const desired = `${niceTitle}_${initial.bvid}`;

    let existing: string[] = [];
    try {
      existing = await fsp.readdir(dir);
    } catch {
      existing = [];
    }
    const baseName = pickAvailableBaseName(existing, desired);

    const result = await downloadAudio({
      bvid: initial.bvid,
      cid: info.cid,
      dir,
      baseName,
      coverUrl: info.cover,
    });

    const track = await readTrack(dateDir, result.fileName);
    const tracks = track ? [{ ...track, bvid: track.bvid || initial.bvid }] : [];

    jobs.set(id, {
      ...initial,
      status: "completed",
      updatedAt: nowMs(),
      tracks,
      error: undefined,
    });
  } catch (err) {
    jobs.set(id, {
      ...initial,
      status: "failed",
      updatedAt: nowMs(),
      tracks: [],
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** 创建一组任务，返回创建后的快照。 */
export function enqueueConvertJobs(bvids: string[]): ConvertJob[] {
  const created: ConvertJob[] = [];
  const seen = new Set<string>();
  for (const raw of bvids) {
    const bv = raw.trim();
    if (!bv || seen.has(bv)) continue;
    seen.add(bv);

    const id = randomUUID();
    const job: ConvertJob = {
      id,
      bvid: bv,
      status: "queued",
      createdAt: nowMs(),
      updatedAt: nowMs(),
      tracks: [],
    };
    jobs.set(id, job);
    queue.push(id);
    created.push(job);
  }
  if (created.length > 0) scheduleDrain();
  return created;
}

/** 获取一组任务的当前快照。 */
export function getJobsSnapshot(ids: string[]): ConvertJob[] {
  const out: ConvertJob[] = [];
  for (const id of ids) {
    const j = jobs.get(id);
    if (j) out.push(j);
  }
  return out;
}

/** 调试：列出所有任务。 */
export function listAllJobs(): ConvertJob[] {
  return Array.from(jobs.values());
}
