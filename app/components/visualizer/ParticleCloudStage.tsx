"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Message } from "@/app/components/chat/Message";
import { DanmakuOverlay } from "@/app/components/danmaku/DanmakuOverlay";
import { Pill } from "@/app/components/ui/Pill";
import { useAgent } from "@/app/context/AgentContext";
import { useMode } from "@/app/context/ModeContext";
import { usePlayer } from "@/app/context/PlayerContext";
import {
  CyberParticleCloudRenderer,
  DEFAULT_PARTICLE_FX_CONFIG,
  createCyberFallbackCanvas,
  type ParticleFxConfig,
} from "./particleCloudRenderer";

type FxKey = keyof Omit<ParticleFxConfig, "escapeCount">;

const FX_CONTROLS: Array<{
  key: FxKey;
  label: string;
  min: number;
  max: number;
  step: number;
}> = [
  { key: "dispersion", label: "Dispersion", min: 0, max: 5, step: 0.01 },
  { key: "particleSize", label: "Particle Size", min: 0.1, max: 10, step: 0.01 },
  { key: "contrast", label: "Contrast", min: 0, max: 3, step: 0.01 },
  { key: "flowSpeed", label: "Flow Speed", min: 0, max: 5, step: 0.01 },
  { key: "flowAmplitude", label: "Flow Range", min: 0, max: 5, step: 0.01 },
  { key: "escapeSpeed", label: "Escape Speed", min: 0.05, max: 1.4, step: 0.01 },
  { key: "escapeMotion", label: "Escape Motion", min: 0.2, max: 2, step: 0.01 },
  { key: "opacityBoost", label: "Glow Opacity", min: 0.4, max: 2.4, step: 0.01 },
  { key: "depthStrength", label: "Depth Strength", min: 0, max: 24, step: 0.05 },
  { key: "sphereRadius", label: "Sphere Radius", min: 3, max: 18, step: 0.05 },
  { key: "sphereStrength", label: "Gravity Strength", min: 0, max: 2.6, step: 0.01 },
  { key: "sphereMass", label: "Gravity Mass", min: 0.1, max: 2, step: 0.01 },
  { key: "colorShiftSpeed", label: "Hue Flow", min: 0, max: 2, step: 0.01 },
  { key: "danceStrength", label: "Audio Dance", min: 0, max: 5, step: 0.01 },
  { key: "depthWave", label: "Depth Wave", min: 0, max: 5, step: 0.01 },
];

export function ParticleCloudStage() {
  const { current, playing } = usePlayer();
  const [sourceName, setSourceName] = useState("Kuro Neon Core");
  const [particleError, setParticleError] = useState<string | null>(null);
  const [fxOpen, setFxOpen] = useState(false);
  const [fxConfig, setFxConfig] = useState<ParticleFxConfig>(DEFAULT_PARTICLE_FX_CONFIG);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<CyberParticleCloudRenderer | null>(null);
  const fxConfigRef = useRef<ParticleFxConfig>(DEFAULT_PARTICLE_FX_CONFIG);
  const manualOverrideRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    try {
      const renderer = new CyberParticleCloudRenderer(fxConfigRef.current);
      renderer.mount(host);
      rendererRef.current = renderer;
      void renderer.setImageSource(createCyberFallbackCanvas("AIyou"));
    } catch {
      setParticleError("WebGL stage unavailable");
    }

    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setPlaying(playing);
  }, [playing]);

  useEffect(() => {
    let cancelled = false;
    const renderer = rendererRef.current;
    if (!renderer) return;

    const fallback = async () => {
      if (cancelled) return;
      setSourceName(current?.title ?? "Kuro Neon Core");
      await renderer.setImageSource(createCyberFallbackCanvas(current?.title?.slice(0, 8) || "AIyou"));
    };

    if (manualOverrideRef.current) {
      if (!current?.cover) manualOverrideRef.current = false;
      else return () => {
        cancelled = true;
      };
    }

    if (!current?.cover) {
      void fallback();
      return () => {
        cancelled = true;
      };
    }

    setSourceName(current.title || current.author || "Cover Signal");
    renderer.setImageSource(current.cover).catch(() => {
      void fallback();
    });

    return () => {
      cancelled = true;
    };
  }, [current?.cover, current?.title, current?.author]);

  const handleFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const renderer = rendererRef.current;
    if (!file || !renderer) return;

    manualOverrideRef.current = true;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      renderer.setImageSource(reader.result).then(() => {
        setSourceName(file.name);
      }).catch(() => {
        setParticleError("Image signal failed");
      });
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }, []);

  const updateFx = useCallback((key: FxKey, value: number) => {
    setFxConfig((prev) => {
      const next = { ...prev, [key]: value };
      fxConfigRef.current = next;
      rendererRef.current?.updateConfig({ [key]: value });
      return next;
    });
  }, []);

  const resetFx = useCallback(() => {
    const next = { ...DEFAULT_PARTICLE_FX_CONFIG };
    fxConfigRef.current = next;
    setFxConfig(next);
    rendererRef.current?.updateConfig(next);
  }, []);

  const statusText = useMemo(() => {
    if (particleError) return particleError;
    if (current?.cover) return playing ? "cover signal overdrive" : "cover signal locked";
    if (current) return playing ? "track pulse active" : "track signal armed";
    return "import cover art to ignite particles";
  }, [current, particleError, playing]);

  return (
    <section className="cyber-stage relative flex min-h-[calc(100dvh-238px)] overflow-hidden px-2 py-3 md:min-h-[calc(100dvh-270px)] md:px-4 md:py-4">
      <div className="pointer-events-none absolute inset-0 cyber-stage-bg" />
      <div className="pointer-events-none absolute inset-0 cyber-scanlines" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black via-black/55 to-transparent" />

      <div className="absolute left-3 right-3 top-4 z-20 flex flex-col gap-3 md:left-6 md:right-6 md:top-5 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 border border-[rgba(0,229,255,0.26)] bg-black/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100 shadow-[0_0_24px_rgba(0,229,255,0.18)] backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff3ab1] shadow-[0_0_16px_rgba(255,58,177,1)]" />
            Kuro Neon Particle Stage
          </div>
          <h1 className="mt-3 max-w-[780px] text-balance font-black uppercase leading-[0.92] tracking-[0.03em] text-white drop-shadow-[0_0_24px_rgba(255,58,177,0.38)] text-[clamp(2.2rem,5vw,5.6rem)]">
            {current?.title ?? "Cyber Idol Signal"}
          </h1>
          <p className="mt-3 max-w-xl truncate text-[12px] uppercase tracking-[0.18em] text-[rgb(var(--fg-secondary))] md:text-[13px]">
            {current?.author || sourceName} / {statusText}
          </p>
        </div>

        <label className="group ml-auto inline-flex h-11 cursor-pointer items-center justify-center gap-2 border border-[rgba(255,58,177,0.36)] bg-[rgba(255,58,177,0.12)] px-4 text-[12px] font-black uppercase tracking-[0.12em] text-white shadow-[0_0_28px_rgba(255,58,177,0.20)] backdrop-blur transition hover:border-[rgba(0,229,255,0.58)] hover:bg-[rgba(0,229,255,0.12)]">
          <UploadIcon />
          Import Art
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
        <button
          type="button"
          onClick={() => setFxOpen((open) => !open)}
          className={[
            "inline-flex h-11 items-center justify-center gap-2 border px-4 text-[12px] font-black uppercase tracking-[0.12em] text-white shadow-[0_0_28px_rgba(0,229,255,0.16)] backdrop-blur transition",
            fxOpen
              ? "border-[rgba(0,229,255,0.62)] bg-[rgba(0,229,255,0.16)]"
              : "border-[rgba(0,229,255,0.28)] bg-black/35 hover:border-[rgba(255,58,177,0.54)] hover:bg-[rgba(255,58,177,0.12)]",
          ].join(" ")}
        >
          <TuneIcon />
          FX Controls
        </button>
      </div>

      {fxOpen ? (
        <ParticleFxPanel
          config={fxConfig}
          onChange={updateFx}
          onReset={resetFx}
          onClose={() => setFxOpen(false)}
        />
      ) : null}

      <div ref={hostRef} className="absolute inset-0 z-0 h-full w-full" />
      <FloorLights playing={playing} />

      {current?.bvid ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-12 top-28 z-20 overflow-hidden border border-[rgba(0,229,255,0.16)] bg-black/10 md:left-10 md:right-[23.5rem] md:top-36">
          <DanmakuOverlay />
        </div>
      ) : null}

      <StageAgentPanel />

      <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 hidden -translate-x-1/2 items-center gap-3 border border-[rgba(255,58,177,0.28)] bg-black/45 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))] shadow-[0_0_26px_rgba(255,58,177,0.18)] backdrop-blur md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-[#00e5ff] shadow-[0_0_16px_rgba(0,229,255,1)]" />
        Right drag rotates / scroll zooms / pointer bends the gravity sphere
      </div>
    </section>
  );
}

function StageAgentPanel() {
  const { turns, loading, thinking, panelOpen, closePanel } = useAgent();
  const { mode } = useMode();
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const visibleTurns = turns.slice(-8);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [visibleTurns, thinking]);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (target.closest("[data-agent-trigger]")) return;
      closePanel();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [panelOpen, closePanel]);

  if (!panelOpen) return null;

  return (
    <aside
      ref={panelRef}
      data-agent-panel
      className="absolute inset-x-4 bottom-4 top-[7rem] z-30 flex overflow-hidden border border-[rgba(0,229,255,0.24)] bg-[rgba(2,4,12,0.72)] shadow-[0_0_42px_rgba(0,229,255,0.12)] backdrop-blur-xl md:inset-x-auto md:right-6 md:top-6 md:w-[21rem]"
    >
      <div className="flex min-h-0 w-full flex-col">
        <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#ff3ab1] shadow-[0_0_14px_rgba(255,58,177,0.9)]" />
          <div className="text-[13px] font-black uppercase tracking-[0.12em] text-white">Neon Agent</div>
          <Pill tone={mode === "cloud" ? "primary" : "neutral"}>
            {mode === "cloud" ? "Cloud" : "Local"}
          </Pill>
          <div className="ml-auto text-[11px] uppercase tracking-[0.12em] text-[rgb(var(--fg-muted))]">
            {loading ? "Live" : "Ready"}
          </div>
        </div>

        <div ref={listRef} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {visibleTurns.length === 0 && !thinking ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <div className="mb-3 text-[15px] font-black uppercase tracking-[0.08em] text-white">Signal waiting</div>
              <p className="max-w-[220px] text-[12.5px] text-[rgb(var(--fg-muted))]">
                Ask for a track or a video below. The answer will dock here without covering the stage core.
              </p>
            </div>
          ) : (
            <>
              {visibleTurns.map((turn) => <Message key={turn.id} turn={turn} />)}
              {thinking ? <StageThinking /> : null}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function ParticleFxPanel({
  config,
  onChange,
  onReset,
  onClose,
}: {
  config: ParticleFxConfig;
  onChange: (key: FxKey, value: number) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="absolute right-3 top-[8.2rem] z-40 w-[min(24rem,calc(100vw-1.5rem))] border border-[rgba(0,229,255,0.28)] bg-[rgba(2,4,12,0.86)] shadow-[0_0_46px_rgba(0,229,255,0.16),0_26px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl md:right-6 md:top-[6.1rem]">
      <header className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-[#00e5ff] shadow-[0_0_14px_rgba(0,229,255,0.95)]" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-white">
            Particle FX Console
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">
            ParticleCloud live uniforms
          </div>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="border border-[rgba(255,58,177,0.3)] bg-[rgba(255,58,177,0.10)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:bg-[rgba(255,58,177,0.18)]"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close FX Controls"
          className="inline-flex h-7 w-7 items-center justify-center border border-[rgba(0,229,255,0.18)] bg-black/40 text-white hover:bg-[rgba(0,229,255,0.12)]"
        >
          x
        </button>
      </header>

      <div className="thin-scroll max-h-[min(62vh,34rem)] overflow-y-auto px-4 py-3">
        <div className="grid gap-3">
          {FX_CONTROLS.map((control) => (
            <FxSlider
              key={control.key}
              control={control}
              value={config[control.key]}
              onChange={(value) => onChange(control.key, value)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function FxSlider({
  control,
  value,
  onChange,
}: {
  control: (typeof FX_CONTROLS)[number];
  value: number;
  onChange: (value: number) => void;
}) {
  const pct = ((value - control.min) / (control.max - control.min)) * 100;
  return (
    <label className="grid gap-2 border border-[rgba(255,255,255,0.07)] bg-black/28 px-3 py-2.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[rgb(var(--fg-secondary))]">
          {control.label}
        </span>
        <span className="font-mono text-[11px] text-white">
          {value.toFixed(control.step < 0.05 ? 2 : 1)}
        </span>
      </span>
      <span className="relative h-8">
        <span className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 bg-[rgba(0,229,255,0.12)]" />
        <span
          className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 bg-gradient-to-r from-[#00e5ff] to-[#ff3ab1] shadow-[0_0_14px_rgba(255,58,177,0.45)]"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="relative z-10 h-8 w-full cursor-pointer opacity-0"
          aria-label={control.label}
        />
      </span>
    </label>
  );
}

function StageThinking() {
  return (
    <div className="mb-3 flex justify-start">
      <div className="border border-[rgba(255,58,177,0.24)] bg-white/[0.05] px-4 py-3">
        <div className="dot-pulse flex items-center gap-1.5">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function FloorLights({ playing }: { playing: boolean }) {
  const NUM_BEAMS = 96;
  const beamsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let rafId: number;
    const targets = new Float32Array(NUM_BEAMS);
    const current = new Float32Array(NUM_BEAMS);
    let beatCountdown = 0;

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      beatCountdown--;
      const isBeat = beatCountdown <= 0;
      if (isBeat) beatCountdown = 9 + Math.random() * 18;

      for (let i = 0; i < NUM_BEAMS; i++) {
        const p = i / NUM_BEAMS;
        const maxH = Math.max(0.2, 1.1 - p * 0.58);
        if (playing && Math.random() < 0.16) targets[i] = Math.random() * maxH * 0.48;
        if (playing && isBeat && (p < 0.22 || p > 0.78)) targets[i] = 0.7 + Math.random() * 0.4;
        if (playing && isBeat && p > 0.35 && p < 0.65 && Math.random() < 0.45) targets[i] = 0.45 + Math.random() * 0.35;
        targets[i] *= playing ? 0.84 : 0.68;

        if (current[i] < targets[i]) current[i] += (targets[i] - current[i]) * 0.58;
        else current[i] -= playing ? 0.024 : 0.04;
        current[i] = Math.max(0.025, Math.min(1.05, current[i]));

        const el = beamsRef.current[i];
        if (el) {
          el.style.transform = `scaleY(${current[i]})`;
          el.style.opacity = `${playing ? 0.34 + current[i] * 0.66 : 0.18}`;
        }
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-40 overflow-hidden md:h-56">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-end justify-between px-4 opacity-95 mix-blend-screen md:px-8">
        {Array.from({ length: NUM_BEAMS }).map((_, i) => (
          <div key={i} className="relative flex h-full w-[1.5px] items-end justify-center md:w-[2px]">
            <div
              ref={(el) => {
                beamsRef.current[i] = el;
              }}
              className="w-full origin-bottom bg-gradient-to-t from-[rgba(255,58,177,0.02)] via-[rgba(255,58,177,0.78)] to-[rgba(0,229,255,0.95)] shadow-[0_0_18px_rgba(255,58,177,0.9)]"
              style={{ transform: "scaleY(0.02)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M20 16.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2.5" />
    </svg>
  );
}

function TuneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <path d="M16 5v4" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <path d="M8 15v4" />
    </svg>
  );
}
