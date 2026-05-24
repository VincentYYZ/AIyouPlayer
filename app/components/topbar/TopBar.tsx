"use client";

export function TopBar() {
  return (
    <header className="relative z-30 px-4 pt-4 md:px-6 md:pt-5">
      <div className="flex items-start">
        <Logo />
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[rgba(99,102,241,0.9)] via-[rgba(168,85,247,0.88)] to-[rgba(236,72,153,0.9)] shadow-[0_10px_26px_-10px_rgba(168,85,247,0.85)]"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </span>
      <div className="leading-none">
        <div className="bg-gradient-to-r from-white via-[rgba(216,180,254,0.98)] to-[rgba(125,211,252,0.96)] bg-clip-text text-[18px] font-semibold italic tracking-[0.08em] text-transparent drop-shadow-[0_2px_14px_rgba(167,139,250,0.3)] md:text-[20px]">
          AI<span className="font-black tracking-[0.12em] text-[rgba(255,255,255,0.96)]">you</span>Player
        </div>
        <div className="mt-1 pl-[1px] text-[9.5px] uppercase tracking-[0.34em] text-[rgba(255,255,255,0.42)] md:text-[10px]">
          Aurora Audio Dreamscape
        </div>
      </div>
    </div>
  );
}
