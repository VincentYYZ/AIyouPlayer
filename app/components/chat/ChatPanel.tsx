"use client";

import { useEffect, useRef } from "react";
import { Composer } from "@/app/components/chat/Composer";
import { Message } from "@/app/components/chat/Message";
import { Pill } from "@/app/components/ui/Pill";
import { useAgent } from "@/app/context/AgentContext";
import { useMode } from "@/app/context/ModeContext";

export function ChatPanel({ compact = false }: { compact?: boolean }) {
  const { turns, send, cancel, loading, thinking } = useAgent();
  const { mode } = useMode();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns, thinking]);

  return (
    <section
      className={[
        "glass-strong flex h-full w-full flex-col overflow-hidden p-0",
        compact ? "min-h-[250px]" : "min-h-[420px]",
      ].join(" ")}
    >
      <header className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <span className="inline-flex h-2 w-2 rounded-full bg-[rgb(var(--accent))] shadow-[0_0_10px_rgba(167,139,250,0.7)]" />
        <h2 className="text-[13.5px] font-semibold tracking-wide text-white">
          Aurora Agent
        </h2>
        <Pill tone={mode === "cloud" ? "primary" : "neutral"}>
          {mode === "cloud" ? "Cloud · B站" : "Local · 曲库"}
        </Pill>
        <div className="ml-auto">
          {loading ? (
            <Pill tone="primary">PROCESSING</Pill>
          ) : (
            <Pill tone="neutral">READY</Pill>
          )}
        </div>
      </header>

      <div
        ref={listRef}
        className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5"
      >
        {turns.length === 0 && !thinking ? (
          <Welcome mode={mode} />
        ) : (
          <>
            {turns.map((t) => (
              <Message key={t.id} turn={t} />
            ))}
            {thinking && <Thinking />}
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-white/5 px-3 py-3 md:px-5">
        <Composer
          busy={loading}
          onCancel={cancel}
          onSubmit={(t) => void send(t)}
        />
      </div>
    </section>
  );
}

function Thinking() {
  return (
    <div className="mb-3 flex justify-start">
      <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.05] px-4 py-3">
        <div className="dot-pulse flex items-center gap-1.5">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function Welcome({ mode }: { mode: "local" | "cloud" }) {
  const tip =
    mode === "cloud"
      ? "试试：‘搜一下林俊杰的现场’、‘BV1xx 帮我转音频’"
      : "试试：‘随便放一首’、‘搜一下夜曲’";
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[rgba(99,102,241,0.8)] via-[rgba(168,85,247,0.8)] to-[rgba(236,72,153,0.7)] shadow-[0_20px_40px_-15px_rgba(168,85,247,0.6)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
        </svg>
      </div>
      <h3 className="text-[16px] font-semibold tracking-tight text-white">
        随便聊点什么
      </h3>
      <p className="mt-1 max-w-sm text-[13px] text-[rgb(var(--fg-muted))]">
        {tip}
      </p>
    </div>
  );
}
