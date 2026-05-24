"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/app/components/ui/IconButton";
import { useAgent } from "@/app/context/AgentContext";
import { useDanmaku } from "@/app/context/DanmakuContext";
import { usePlayer } from "@/app/context/PlayerContext";
import type { AudioTrack } from "@/app/lib/types";

export function PlayerBar() {
  const {
    current,
    playing,
    currentTime,
    duration,
    volume,
    muted,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    attachAudio,
    playTrack,
    addToQueue,
  } = usePlayer();
  const { enabled, toggle } = useDanmaku();
  const { send, cancel, loading, openPanel } = useAgent();

  const audioRef = useRef<HTMLAudioElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [agentQuery, setAgentQuery] = useState("");
  const [libraryTracks, setLibraryTracks] = useState<AudioTrack[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  useEffect(() => {
    attachAudio(audioRef.current);
    return () => attachAudio(null);
  }, [attachAudio]);

  const pct = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const agentPlaceholder = "联网搜索歌曲 / 视频，例如：周杰伦 夜曲 live";

  const searchLocalTracks = useCallback(async (keyword: string) => {
    setLibraryLoading(true);
    try {
      const url = keyword
        ? `/api/search?q=${encodeURIComponent(keyword)}&limit=24`
        : "/api/tracks/scan";
      const res = await fetch(url);
      const data = (await res.json()) as { tracks?: AudioTrack[] };
      setLibraryTracks(Array.isArray(data.tracks) ? data.tracks.slice(0, 18) : []);
    } catch {
      setLibraryTracks([]);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  const submitLibrarySearch = useCallback(() => {
    void searchLocalTracks(libraryQuery.trim());
  }, [searchLocalTracks, libraryQuery]);

  const openLibrary = useCallback(() => {
    const nextOpen = !libraryOpen;
    setLibraryOpen(nextOpen);
    if (nextOpen) {
      void searchLocalTracks(libraryQuery.trim());
    }
  }, [libraryOpen, searchLocalTracks, libraryQuery]);

  const submitAgent = useCallback(() => {
    const text = agentQuery.trim();
    if (!text || loading) return;
    openPanel();
    void send(text, { mode: "cloud" });
    setAgentQuery("");
    setLibraryOpen(false);
  }, [agentQuery, loading, openPanel, send]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-3 md:px-6 md:pb-5">
      <div className="pointer-events-auto mx-auto w-full max-w-[1480px]">
        <div className="glass-strong relative overflow-visible px-3 py-3 md:px-4">
          {libraryOpen ? (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-3 md:left-4 md:right-auto md:w-[28rem]">
              <div className="overflow-hidden rounded-[26px] border border-white/10 bg-[rgba(8,12,26,0.92)] shadow-[0_24px_80px_-24px_rgba(15,23,42,0.9)] backdrop-blur-xl">
                <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                  <span className="inline-flex h-2 w-2 rounded-full bg-[rgb(var(--accent-strong))] shadow-[0_0_12px_rgba(196,181,253,0.8)]" />
                  <div className="text-[13px] font-semibold text-white">本地曲目</div>
                  <div className="ml-auto text-[11.5px] text-[rgb(var(--fg-muted))]">
                    {libraryLoading ? "搜索中…" : `${libraryTracks.length} 首结果`}
                  </div>
                </div>
                <div className="border-b border-white/5 px-3 py-3">
                  <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <SearchIcon />
                    <input
                      autoFocus
                      value={libraryQuery}
                      onChange={(e) => setLibraryQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submitLibrarySearch();
                        }
                      }}
                      placeholder="搜索本地曲目（标题 / 歌手 / 文件名）"
                      className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-[rgb(var(--fg-muted))] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={submitLibrarySearch}
                      className="inline-flex h-8 items-center rounded-full bg-white/10 px-3 text-[12px] font-medium text-white transition hover:bg-white/15"
                    >
                      搜索
                    </button>
                  </div>
                </div>
                <div className="thin-scroll max-h-[22rem] overflow-y-auto px-2 py-2">
                  {libraryLoading ? (
                    <div className="flex min-h-[140px] items-center justify-center text-[12px] text-[rgb(var(--fg-muted))]">
                      正在加载本地曲目…
                    </div>
                  ) : libraryTracks.length === 0 ? (
                    <div className="flex min-h-[140px] items-center justify-center text-[12px] text-[rgb(var(--fg-muted))]">
                      暂无匹配曲目
                    </div>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {libraryTracks.map((track) => {
                        const active = current?.id === track.id;
                        return (
                          <li
                            key={track.id}
                            className={[
                              "group flex items-center gap-3 rounded-2xl px-3 py-2 transition",
                              active
                                ? "bg-gradient-to-r from-[rgba(167,139,250,0.18)] to-transparent"
                                : "hover:bg-white/[0.04]",
                            ].join(" ")}
                          >
                            <button
                              type="button"
                              className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                              onClick={() => {
                                playTrack(track);
                                setLibraryOpen(false);
                              }}
                              title="播放"
                              aria-label="播放"
                              style={
                                track.cover
                                  ? {
                                      backgroundImage: `linear-gradient(rgba(3,7,18,0.28), rgba(3,7,18,0.28)), url(${track.cover})`,
                                      backgroundPosition: "center",
                                      backgroundSize: "cover",
                                    }
                                  : undefined
                              }
                            >
                              <PlayIcon />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-medium text-white">
                                {track.title}
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[rgb(var(--fg-muted))]">
                                <span className="truncate">{track.author || "未知歌手"}</span>
                                {track.dir ? <span className="truncate opacity-70">{track.dir}</span> : null}
                              </div>
                            </div>
                            <IconButton
                              size="sm"
                              tone="ghost"
                              onClick={() => addToQueue([track])}
                              title="加入队列"
                              aria-label="加入队列"
                            >
                              <PlusIcon />
                            </IconButton>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
            {/* 当前曲目 */}
            <div className="flex min-w-0 items-center gap-3 xl:w-[240px] xl:flex-none">
              <Disc spinning={!!current && playing} cover={current?.cover} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold text-white">
                  {current?.title ?? "尚未选择曲目"}
                </div>
                <div className="truncate text-[11.5px] text-[rgb(var(--fg-muted))]">
                  {current?.author || (current ? "未知歌手" : "在 Agent 或曲库中选择音乐")}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center xl:min-w-0 xl:flex-[1.35]">
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={openLibrary}
                  className={[
                    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[12.5px] font-medium transition",
                    libraryOpen
                      ? "border-[rgba(167,139,250,0.45)] bg-[rgba(167,139,250,0.16)] text-white"
                      : "border-white/10 bg-white/[0.05] text-[rgb(var(--fg-secondary))] hover:text-white",
                  ].join(" ")}
                >
                  <LibraryIcon />
                  本地曲目
                </button>
              </div>

              <div
                data-agent-trigger
                className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-black/10 px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              >
                <SearchIcon />
                <input
                  value={agentQuery}
                  onChange={(e) => setAgentQuery(e.target.value)}
                  onFocus={openPanel}
                  onMouseDown={openPanel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitAgent();
                    }
                  }}
                  placeholder={agentPlaceholder}
                  className="min-w-0 flex-1 bg-transparent pr-2 text-[13.5px] text-white placeholder:text-[rgb(var(--fg-muted))] focus:outline-none"
                />
                {loading ? (
                  <button
                    type="button"
                    onClick={cancel}
                    className="inline-flex h-8 items-center rounded-full bg-white/10 px-3 text-[12px] font-medium text-white transition hover:bg-white/15"
                  >
                    停止
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitAgent}
                    className="inline-flex h-8 items-center rounded-full bg-gradient-to-r from-[rgba(99,102,241,0.92)] to-[rgba(236,72,153,0.82)] px-3.5 text-[12px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(167,139,250,0.75)] transition hover:brightness-110"
                  >
                    发送
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-3 xl:min-w-0 xl:flex-1 xl:rounded-full xl:px-4 xl:py-2.5">

            {/* 控制 */}
            <div className="flex shrink-0 items-center justify-center gap-2 md:justify-start">
              <IconButton size="sm" tone="ghost" onClick={prev} aria-label="上一首">
                <PrevIcon />
              </IconButton>
              <IconButton
                size="lg"
                tone="primary"
                onClick={togglePlay}
                aria-label={playing ? "暂停" : "播放"}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
              <IconButton size="sm" tone="ghost" onClick={next} aria-label="下一首">
                <NextIcon />
              </IconButton>
            </div>

            {/* 进度 */}
            <div className="flex min-w-0 items-center gap-2.5 lg:gap-3">
              <span className="w-10 shrink-0 text-right font-mono text-[11px] text-[rgb(var(--fg-muted))]">
                {fmt(currentTime)}
              </span>
              <ProgressBar
                progress={pct}
                onSeek={(p) => seek(p * duration)}
              />
              <span className="w-10 shrink-0 font-mono text-[11px] text-[rgb(var(--fg-muted))]">
                {fmt(duration)}
              </span>
            </div>

            {/* 音量 + 弹幕开关 */}
            <div className="flex shrink-0 items-center justify-end gap-2 md:min-w-fit">
              <VolumeControl
                muted={muted}
                volume={volume}
                onToggleMute={toggleMute}
                onVolume={setVolume}
              />
              {current?.bvid ? (
                <IconButton
                  size="sm"
                  tone={enabled ? "primary" : "ghost"}
                  className="shrink-0"
                  onClick={toggle}
                  title={enabled ? "关闭弹幕" : "开启弹幕"}
                  aria-label="弹幕"
                >
                  <DanmakuIcon />
                </IconButton>
              ) : null}
            </div>
          </div>

          </div>

          <audio ref={audioRef} preload="metadata" />
        </div>
      </div>
      <style>{`
        .aurora-range {
          appearance: none;
          height: 4px;
          background: linear-gradient(90deg, rgba(167,139,250,0.6), rgba(236,72,153,0.55));
          border-radius: 4px;
          outline: none;
          opacity: 0.85;
        }
        .aurora-range::-webkit-slider-thumb {
          appearance: none;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: white;
          box-shadow: 0 2px 8px rgba(167,139,250,0.6);
          cursor: pointer;
        }
        .aurora-range::-moz-range-thumb {
          width: 12px; height: 12px;
          border-radius: 50%;
          background: white;
          border: 0;
          box-shadow: 0 2px 8px rgba(167,139,250,0.6);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function Disc({ spinning, cover }: { spinning: boolean; cover?: string }) {
  return (
    <div
      className={[
        "relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-[rgba(99,102,241,0.6)] via-[rgba(168,85,247,0.6)] to-[rgba(236,72,153,0.55)] shadow-[0_8px_24px_-12px_rgba(167,139,250,0.7)]",
        spinning ? "disc-spin" : "",
      ].join(" ")}
      aria-hidden
    >
      {cover ? (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-95"
          style={{ backgroundImage: `url(${cover})` }}
        />
      ) : null}
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_36%,rgba(10,14,34,0.18)_68%,rgba(10,14,34,0.65)_100%)]" />
      <span className="absolute inset-[36%] rounded-full bg-[#0a0e22]" />
      <style>{`
        @keyframes disc-rotate { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        .disc-spin { animation: disc-rotate 6s linear infinite; }
      `}</style>
    </div>
  );
}

function ProgressBar({
  progress,
  onSeek,
}: {
  progress: number;
  onSeek: (p: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(p);
  };
  return (
    <div
      ref={ref}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="relative h-1.5 min-w-0 flex-1 cursor-pointer rounded-full bg-white/10"
      onClick={(e) => handle(e.clientX)}
    >
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[rgba(99,102,241,0.9)] via-[rgba(168,85,247,0.9)] to-[rgba(236,72,153,0.85)]"
        style={{ width: `${progress * 100}%` }}
      />
      <div
        className="absolute -top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white shadow"
        style={{ left: `${progress * 100}%` }}
      />
    </div>
  );
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function VolumeControl({
  muted,
  volume,
  onToggleMute,
  onVolume,
}: {
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="group relative inline-flex items-center">
      <IconButton
        size="sm"
        tone="ghost"
        onClick={onToggleMute}
        aria-label={muted ? "取消静音" : "静音"}
      >
        {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
      </IconButton>
      <div className="pointer-events-none absolute bottom-full right-0 mb-2 translate-y-1 opacity-0 transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(8,12,26,0.92)] px-3 py-2 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="aurora-range w-28"
            aria-label="音量"
          />
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4v16l13-8z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1.2" />
      <rect x="14" y="5" width="4" height="14" rx="1.2" />
    </svg>
  );
}
function PrevIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h2v14H6zM20 5L9 12l11 7z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[rgb(var(--fg-muted))]">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function LibraryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}
function NextIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 5h2v14h-2zM4 5l11 7L4 19z" />
    </svg>
  );
}
function VolumeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M16 8a5 5 0 0 1 0 8" />
    </svg>
  );
}
function MuteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H3v6h3l5 4V5z" />
      <path d="M22 9l-5 6M17 9l5 6" />
    </svg>
  );
}
function DanmakuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 4V6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}
