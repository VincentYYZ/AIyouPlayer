"use client";

import { useCallback, useEffect, useState } from "react";
import { IconButton } from "@/app/components/ui/IconButton";
import { Pill } from "@/app/components/ui/Pill";
import { useAgent } from "@/app/context/AgentContext";
import { useMode } from "@/app/context/ModeContext";
import { usePlayer } from "@/app/context/PlayerContext";
import type { AudioTrack, BiliSearchItem } from "@/app/lib/types";

export function LibraryPanel({ compact = false }: { compact?: boolean }) {
  const { mode } = useMode();
  return (
    <section
      className={[
        "glass-strong flex h-full w-full flex-col overflow-hidden p-0",
        compact ? "min-h-[250px]" : "min-h-[420px]",
      ].join(" ")}
    >
      <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="inline-flex h-2 w-2 rounded-full bg-[rgb(var(--accent-strong))] shadow-[0_0_10px_rgba(196,181,253,0.7)]" />
        <h2 className="text-[13.5px] font-semibold tracking-wide text-white">
          {mode === "cloud" ? "B 站搜索" : "本地曲库"}
        </h2>
      </header>
      {mode === "cloud" ? <CloudLibrary /> : <LocalLibrary />}
    </section>
  );
}

/* -------------------------- 本地曲库 -------------------------- */

function LocalLibrary() {
  const { addToQueue, playTrack, current } = usePlayer();
  const [q, setQ] = useState("");
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (keyword: string) => {
    setLoading(true);
    try {
      const url = keyword
        ? `/api/search?q=${encodeURIComponent(keyword)}&limit=80`
        : "/api/tracks/scan";
      const res = await fetch(url);
      const data = (await res.json()) as { tracks?: AudioTrack[] };
      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh("");
  }, [refresh]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/5 px-4 py-3">
        <SearchBar
          value={q}
          onChange={setQ}
          onSubmit={() => void refresh(q.trim())}
          placeholder="搜索本地曲库（标题/歌手/文件名）"
        />
      </div>
      <ResultListShell loading={loading} empty={tracks.length === 0}>
        <ul className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {tracks.map((t) => {
            const active = current?.id === t.id;
            return (
              <li
                key={t.id}
                className={[
                  "group flex items-center gap-3 rounded-xl px-2.5 py-2 transition",
                  active
                    ? "bg-gradient-to-r from-[rgba(167,139,250,0.18)] to-transparent"
                    : "hover:bg-white/[0.04]",
                ].join(" ")}
              >
                <button
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-[rgb(var(--accent-strong))] hover:bg-white/10"
                  onClick={() => playTrack(t)}
                  title="播放"
                  aria-label="播放"
                >
                  <PlayIcon />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-white">
                    {t.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[rgb(var(--fg-muted))]">
                    <span className="truncate">{t.author || "未知"}</span>
                    {t.bvid && <Pill tone="primary">{t.bvid}</Pill>}
                    {t.dir && <span className="opacity-70">{t.dir}</span>}
                  </div>
                </div>
                <IconButton
                  size="sm"
                  tone="ghost"
                  onClick={() => addToQueue([t])}
                  title="加入队列"
                  aria-label="加入队列"
                >
                  <PlusIcon />
                </IconButton>
              </li>
            );
          })}
        </ul>
      </ResultListShell>
    </div>
  );
}

/* -------------------------- 云端 B 站 -------------------------- */

function CloudLibrary() {
  const { enqueueDownloads, jobByBvid } = useAgent();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<BiliSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bili/search?keyword=${encodeURIComponent(keyword)}`
      );
      const data = (await res.json()) as { videos?: BiliSearchItem[] };
      setItems(Array.isArray(data.videos) ? data.videos : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-white/5 px-4 py-3">
        <SearchBar
          value={q}
          onChange={setQ}
          onSubmit={() => void search(q)}
          placeholder="搜索 B 站视频，按 Enter 提交"
        />
      </div>
      <ResultListShell loading={loading} empty={items.length === 0 && !loading}>
        <ul className="thin-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {items.map((v) => {
            const job = jobByBvid.get(v.bvid);
            const status = job?.status;
            return (
              <li
                key={v.bvid}
                className="group flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/[0.04]"
              >
                <Cover url={v.cover} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-white">
                    {v.title}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[rgb(var(--fg-muted))]">
                    <span className="truncate">{v.author}</span>
                    {v.duration && <span>· {v.duration}</span>}
                    {Number.isFinite(v.play) && (
                      <span>· {formatPlay(v.play)}</span>
                    )}
                    <Pill tone="primary">{v.bvid}</Pill>
                  </div>
                </div>
                <AddBtn
                  status={status}
                  onAdd={() => enqueueDownloads([v.bvid])}
                />
              </li>
            );
          })}
        </ul>
      </ResultListShell>
    </div>
  );
}

function AddBtn({
  status,
  onAdd,
}: {
  status?: "queued" | "running" | "completed" | "failed";
  onAdd: () => void;
}) {
  if (status === "queued" || status === "running") {
    return (
      <span className="rounded-full border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.12)] px-3 py-1 text-[11.5px] text-[rgb(var(--accent-strong))]">
        {status === "queued" ? "排队" : "下载中"}
      </span>
    );
  }
  if (status === "completed") {
    return <Pill tone="ok">已下载</Pill>;
  }
  if (status === "failed") {
    return (
      <button
        onClick={onAdd}
        className="rounded-full border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.12)] px-3 py-1 text-[11.5px] text-[rgb(var(--err))] hover:bg-[rgba(248,113,113,0.18)]"
      >
        重试
      </button>
    );
  }
  return (
    <button
      onClick={onAdd}
      className="rounded-full bg-gradient-to-r from-[rgba(99,102,241,0.85)] to-[rgba(236,72,153,0.75)] px-3 py-1 text-[11.5px] font-medium text-white shadow-[0_6px_18px_-6px_rgba(167,139,250,0.7)] hover:brightness-110"
    >
      ADD
    </button>
  );
}

function Cover({ url }: { url: string }) {
  return (
    <div className="h-12 w-[68px] shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

function formatPlay(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}亿播`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}万播`;
  return `${n}播`;
}

/* -------------------------- 公共 -------------------------- */

function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
}) {
  return (
    <div className="glass-input flex items-center gap-2 px-3 py-2">
      <SearchIcon />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-white placeholder:text-[rgb(var(--fg-muted))] focus:outline-none"
      />
    </div>
  );
}

function ResultListShell({
  loading,
  empty,
  children,
}: {
  loading: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[180px] flex-1 items-center justify-center text-[12px] text-[rgb(var(--fg-muted))]">
        正在加载…
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex min-h-[180px] flex-1 items-center justify-center text-[12px] text-[rgb(var(--fg-muted))]">
        暂无结果
      </div>
    );
  }
  return <>{children}</>;
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4v16l13-8z" />
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[rgb(var(--fg-muted))]">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

