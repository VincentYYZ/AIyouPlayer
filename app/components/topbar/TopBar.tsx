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
    <div className="group flex items-center gap-3">
      <span
        className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden border border-[rgba(0,229,255,0.24)] bg-black shadow-[0_0_34px_rgba(255,58,177,0.28)]"
        aria-hidden
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.55),transparent_18%),linear-gradient(135deg,rgba(255,58,177,0.92),rgba(0,229,255,0.82))]" />
        <span className="absolute inset-[3px] border border-black/60" />
        <svg className="relative z-10 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </span>
      <div className="leading-none">
        <div className="bg-gradient-to-r from-[#00e5ff] via-white to-[#ff3ab1] bg-clip-text text-[20px] font-black italic uppercase tracking-[0.12em] text-transparent drop-shadow-[0_0_18px_rgba(255,58,177,0.38)] md:text-[23px]">
          AI<span className="tracking-[0.16em] text-white">you</span>Player
        </div>
        <div className="mt-1 inline-flex border border-[rgba(0,229,255,0.16)] bg-black/35 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.32em] text-[rgba(180,235,246,0.78)] shadow-[0_0_18px_rgba(0,229,255,0.10)] md:text-[9.5px]">
          Kuro Neon Idol Console
        </div>
      </div>
    </div>
  );
}
