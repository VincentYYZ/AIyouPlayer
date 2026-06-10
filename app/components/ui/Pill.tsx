"use client";

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  tone?: "neutral" | "primary" | "ok" | "warn" | "err";
}

const TONE: Record<NonNullable<Props["tone"]>, string> = {
  neutral: "bg-black/25 border-[rgba(0,229,255,0.14)] text-[rgb(var(--fg-secondary))]",
  primary:
    "bg-[rgba(255,58,177,0.16)] border-[rgba(0,229,255,0.34)] text-[rgb(var(--accent-strong))]",
  ok: "bg-[rgba(74,222,128,0.12)] border-[rgba(74,222,128,0.4)] text-[rgb(var(--ok))]",
  warn: "bg-[rgba(251,191,36,0.12)] border-[rgba(251,191,36,0.4)] text-[rgb(var(--warn))]",
  err: "bg-[rgba(248,113,113,0.12)] border-[rgba(248,113,113,0.4)] text-[rgb(var(--err))]",
};

export function Pill({ children, tone = "neutral" }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.04em] backdrop-blur",
        TONE[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
