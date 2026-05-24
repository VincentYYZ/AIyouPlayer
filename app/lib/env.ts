import os from "node:os";
import path from "node:path";

/** 解析音频库根目录，环境变量优先。 */
export function getAudioLibDir(): string {
  const fromEnv = process.env.AUDIO_LIB_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.homedir(), "Documents", "aiyou-player");
}

/** B 站登录态 cookie。未设置返回空字符串。 */
export function getBiliSessdata(): string {
  return (process.env.BILI_SESSDATA ?? "").trim();
}

/** 后台并发任务数（默认 3，下限 1，上限 8） */
export function getConvertConcurrency(): number {
  const raw = Number(process.env.BILI_CONCURRENCY);
  if (!Number.isFinite(raw) || raw <= 0) return 3;
  return Math.max(1, Math.min(8, Math.floor(raw)));
}

/** 单流下载超时（毫秒，默认 120000） */
export function getDownloadTimeoutMs(): number {
  const raw = Number(process.env.BILI_DOWNLOAD_TIMEOUT_MS);
  if (!Number.isFinite(raw) || raw <= 0) return 120_000;
  return Math.floor(raw);
}

/** ffmpeg 可执行路径（默认走 PATH） */
export function getFfmpegBin(): string {
  return (process.env.FFMPEG_BIN ?? "").trim() || "ffmpeg";
}
