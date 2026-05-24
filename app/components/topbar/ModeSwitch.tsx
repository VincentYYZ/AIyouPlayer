"use client";

import { useMode } from "@/app/context/ModeContext";
import type { AppMode } from "@/app/lib/types";

const OPTIONS: Array<{ value: AppMode; label: string; hint: string }> = [
  { value: "local", label: "本地", hint: "本地曲库" },
  { value: "cloud", label: "云端", hint: "B 站搜索" },
];

export function ModeSwitch() {
  const { mode, setMode } = useMode();
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur"
      role="tablist"
      aria-label="模式切换"
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => setMode(opt.value)}
            title={opt.hint}
            className={[
              "relative px-3.5 py-1.5 text-[12.5px] font-medium tracking-wide rounded-full transition",
              active
                ? "bg-gradient-to-r from-[rgba(167,139,250,0.65)] to-[rgba(236,72,153,0.55)] text-white shadow-[0_4px_18px_-4px_rgba(167,139,250,0.6)]"
                : "text-[rgb(var(--fg-secondary))] hover:text-white",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
