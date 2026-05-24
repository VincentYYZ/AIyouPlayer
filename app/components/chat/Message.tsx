"use client";

import { useAgent } from "@/app/context/AgentContext";
import type { AudioTrack, ChatTurn } from "@/app/lib/types";

interface Props {
  turn: ChatTurn;
}

export function Message({ turn }: Props) {
  if (turn.role === "user") {
    return (
      <div className="mb-3 flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-md bg-gradient-to-br from-[rgba(99,102,241,0.65)] to-[rgba(168,85,247,0.55)] px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-[0_8px_24px_-12px_rgba(167,139,250,0.6)]">
          {turn.content}
        </div>
      </div>
    );
  }

  if (turn.role === "tool") {
    return (
      <div className="mb-2 flex justify-start">
        <div className="prose-glass max-w-[88%] rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5 text-[12px] text-[rgb(var(--fg-muted))]">
          <span className="mr-1.5 text-[rgb(var(--accent-strong))]">⊕</span>
          <span className="break-all">{turn.content}</span>
        </div>
      </div>
    );
  }

  if (turn.role === "system") {
    return (
      <div className="mb-2 flex justify-center">
        <div className="rounded-full border border-white/5 bg-white/[0.04] px-3 py-1 text-[11.5px] text-[rgb(var(--fg-muted))]">
          {turn.content}
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="mb-3 flex flex-col items-start gap-2">
      {turn.content ? (
        <div className="prose-glass max-w-[88%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[14px] leading-[1.7] text-[rgb(var(--fg-secondary))] backdrop-blur">
          <Markdownish text={turn.content} />
        </div>
      ) : null}
      {turn.tracksCandidates && turn.tracksCandidates.length > 0 ? (
        <TracksCard tracks={turn.tracksCandidates} />
      ) : null}
    </div>
  );
}

/** 助手推荐 B 站候选时显示的可 ADD 卡片。 */
function TracksCard({ tracks }: { tracks: AudioTrack[] }) {
  const { enqueueDownloads, jobByBvid } = useAgent();
  return (
    <div className="w-[min(100%,38rem)] rounded-2xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur">
      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--fg-muted))]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent-strong))]" />
        云端候选
      </div>
      <ul className="flex flex-col gap-1.5">
        {tracks.map((t) => {
          const status = t.bvid ? jobByBvid.get(t.bvid)?.status : undefined;
          return (
            <li
              key={t.id || t.bvid}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/[0.04]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-white">
                  {t.title}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[rgb(var(--fg-muted))]">
                  {t.author ? <span className="truncate">{t.author}</span> : null}
                  {t.duration ? <span>· {t.duration}</span> : null}
                  {t.bvid ? (
                    <span className="rounded-full border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.15)] px-2 py-0.5 text-[10.5px] text-[rgb(var(--accent-strong))]">
                      {t.bvid}
                    </span>
                  ) : null}
                </div>
              </div>
              <AddBtn
                status={status}
                onAdd={() => t.bvid && enqueueDownloads([t.bvid])}
              />
            </li>
          );
        })}
      </ul>
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
      <span className="shrink-0 rounded-full border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.12)] px-3 py-1 text-[11.5px] text-[rgb(var(--accent-strong))]">
        {status === "queued" ? "排队中" : "下载中"}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="shrink-0 rounded-full border border-[rgba(74,222,128,0.4)] bg-[rgba(74,222,128,0.12)] px-3 py-1 text-[11.5px] text-[rgb(var(--ok))]">
        已添加
      </span>
    );
  }
  if (status === "failed") {
    return (
      <button
        onClick={onAdd}
        className="shrink-0 rounded-full border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.12)] px-3 py-1 text-[11.5px] text-[rgb(var(--err))] hover:bg-[rgba(248,113,113,0.18)]"
      >
        重试
      </button>
    );
  }
  return (
    <button
      onClick={onAdd}
      className="shrink-0 rounded-full bg-gradient-to-r from-[rgba(99,102,241,0.85)] to-[rgba(236,72,153,0.75)] px-3.5 py-1 text-[11.5px] font-semibold text-white shadow-[0_6px_18px_-6px_rgba(167,139,250,0.7)] hover:brightness-110"
    >
      ADD
    </button>
  );
}

/** 极轻量 Markdown：换行 + 行内 backtick code。 */
function Markdownish({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, "");
          return (
            <pre key={i} className="my-2">
              <code>{inner}</code>
            </pre>
          );
        }
        return (
          <span key={i}>
            {part.split(/(`[^`]+`)/g).map((seg, j) =>
              seg.startsWith("`") && seg.endsWith("`") ? (
                <code
                  key={j}
                  className="rounded bg-white/10 px-1.5 py-0.5 text-[12.5px]"
                >
                  {seg.slice(1, -1)}
                </code>
              ) : (
                <span key={j}>{seg}</span>
              )
            )}
          </span>
        );
      })}
    </div>
  );
}
