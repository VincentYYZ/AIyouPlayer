/**
 * AIyouPlayer 共享类型
 */

/** 单个曲目的元数据描述。 */
export interface AudioTrack {
  /** 稳定 ID（按相对路径派生） */
  id: string;
  /** 标题（解析自文件名或 ID3） */
  title: string;
  /** 作者，可空 */
  author: string;
  /** 时长描述（mm:ss），未知留空 */
  duration?: string;
  cover?: string;
  /** 文件后缀（含点） */
  ext: string;
  /** 用于直接 <audio src> 的 URL */
  url: string;
  /** B站来源时附带的 BV 号 */
  bvid?: string;
  /** 文件相对子目录（通常按日期归档） */
  dir?: string;
  /** 文件大小（字节） */
  size?: number;
  /** 来源标签 */
  source?: "local" | "bili";
  /** 添加日期（YYYY-MM-DD） */
  addedAt?: string;
}

/** 模式 */
export type AppMode = "local" | "cloud";

/** 聊天消息角色 */
export type ChatRole = "user" | "assistant" | "tool" | "system";

export interface ChatTurn {
  id: string;
  role: ChatRole;
  /** 主体文本（assistant 可能包含 ```tracks 块） */
  content: string;
  /** Unix ms */
  ts: number;
  /** 工具调用名称（仅 role=tool 时） */
  toolName?: string;
  /** 助手消息附带的 BV 候选项（仅 bvid 没本地 url，需要用户 ADD 触发下载） */
  tracksCandidates?: AudioTrack[];
}

/** 转换任务状态机 */
export type ConvertStatus = "queued" | "running" | "completed" | "failed";

export interface ConvertJob {
  id: string;
  bvid: string;
  status: ConvertStatus;
  createdAt: number;
  updatedAt: number;
  tracks: AudioTrack[];
  error?: string;
}

/** B 站搜索条目 */
export interface BiliSearchItem {
  bvid: string;
  title: string;
  author: string;
  duration: string;
  play: number;
  cover: string;
}

/** B 站 DASH 音频流描述 */
export interface BiliDashAudio {
  id: number;
  baseUrl: string;
  backupUrls: string[];
  bandwidth: number;
  codecs: string;
  mimeType: string;
}

/** 弹幕条目 */
export interface DanmakuItem {
  /** 视频内时间，单位秒 */
  time: number;
  text: string;
  /** RGB 颜色（十进制） */
  color?: number;
  /** 字号（small/normal/large） */
  size?: "small" | "normal" | "large";
}
