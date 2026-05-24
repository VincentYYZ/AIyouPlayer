"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Message } from "@/app/components/chat/Message";
import { DanmakuOverlay } from "@/app/components/danmaku/DanmakuOverlay";
import { Pill } from "@/app/components/ui/Pill";
import { useAgent } from "@/app/context/AgentContext";
import { useMode } from "@/app/context/ModeContext";
import { usePlayer } from "@/app/context/PlayerContext";

type PointData = {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
};

export function ParticleCloudStage() {
  const { current, playing, currentTime } = usePlayer();
  const [sourceName, setSourceName] = useState("Aurora Cloud");
  const [pointData, setPointData] = useState<PointData | null>(null);
  const manualOverrideRef = useRef(false);

  useEffect(() => {
    const fallback = buildTextPoints("AIyou");
    if (fallback) setPointData(fallback);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resetFallback = () => {
      const fallback = buildTextPoints("AIyou");
      if (!cancelled && fallback) {
        setPointData(fallback);
        setSourceName(current?.title ?? "Aurora Cloud");
      }
    };

    if (manualOverrideRef.current) {
      if (!current?.cover) {
        manualOverrideRef.current = false;
      } else {
        return () => {
          cancelled = true;
        };
      }
    }

    if (!current?.cover) {
      resetFallback();
      return () => {
        cancelled = true;
      };
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const pd = buildImagePoints(img);
      if (pd && pd.count > 0) {
        setPointData(pd);
        setSourceName(current.title || current.author || "封面粒子云");
        return;
      }
      resetFallback();
    };
    img.onerror = () => {
      if (cancelled) return;
      resetFallback();
    };
    img.src = current.cover;

    return () => {
      cancelled = true;
    };
  }, [current?.cover, current?.title, current?.author]);

  const handleFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      manualOverrideRef.current = true;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const pd = buildImagePoints(img);
          if (pd && pd.count > 0) {
            setPointData(pd);
            setSourceName(file.name);
          }
        };
        if (typeof reader.result === "string") img.src = reader.result;
      };
      reader.readAsDataURL(file);
      event.target.value = "";
    },
    []
  );

  const statusText = useMemo(() => {
    if (current?.cover) return playing ? "Cover reactive cloud" : "Cover particle cloud";
    if (current) return playing ? "Music reactive cloud" : "Paused cloud";
    return "Import image to sculpt 3D particles";
  }, [current, current?.cover, playing]);

  return (
    <section className="relative flex min-h-[calc(100dvh-260px)] overflow-hidden px-2 py-3 md:min-h-[calc(100dvh-300px)] md:px-3 md:py-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(167,139,250,0.15),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(34,211,238,0.1),transparent_30%),radial-gradient(circle_at_84%_76%,rgba(236,72,153,0.1),transparent_35%)]" />
      
      <div className="absolute left-3 right-3 top-3 z-10 flex flex-col gap-3 md:left-4 md:right-4 md:top-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.26em] text-[rgb(var(--accent-strong))] drop-shadow-md">
            3D Particle Cloud Stage
          </div>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.04em] text-white md:text-4xl drop-shadow-md">
            {current?.title ?? "把图片变成会呼吸的 3D 粒子云"}
          </h1>
          <p className="mt-1 truncate text-[12.5px] text-[rgb(var(--fg-muted))] md:text-[13px] drop-shadow-sm">
            {current?.author || sourceName} · {pointData?.count.toLocaleString() ?? 0} particles · {statusText}
          </p>
        </div>
        <label className="ml-auto inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-[12.5px] font-medium text-white backdrop-blur transition hover:bg-white/[0.1] shadow-lg">
          <UploadIcon />
          导入图片
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      </div>
      
      <div className="absolute inset-0 z-0 h-full w-full opacity-90">
        {pointData && (
          <Canvas camera={{ position: [0, 0, 9], fov: 45 }}>
            <ambientLight intensity={0.5} />
            <Cloud positions={pointData.positions} colors={pointData.colors} playing={playing} currentTime={currentTime} />
            <OrbitControls enableZoom enablePan enableRotate autoRotate={false} autoRotateSpeed={0.6} maxDistance={20} minDistance={2} />
          </Canvas>
        )}
      </div>

      <FloorLights playing={playing} />

      {current?.bvid ? (
        <div className="pointer-events-none absolute inset-x-4 top-24 bottom-12 z-20 overflow-hidden rounded-[28px] md:left-10 md:right-[23.5rem] md:top-28">
          <DanmakuOverlay />
        </div>
      ) : null}

      <StageAgentPanel />
      
      <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-[11px] text-[rgb(var(--fg-muted))] backdrop-blur md:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent-strong))] shadow-[0_0_12px_rgba(196,181,253,0.9)]" />
        支持鼠标拖拽旋转缩放，粒子跟随音乐律动
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
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
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
      className="absolute inset-x-4 bottom-4 top-[6.5rem] z-30 flex overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(7,11,24,0.58)] backdrop-blur-xl md:inset-x-auto md:right-6 md:top-6 md:w-[20rem]"
    >
      <div className="flex min-h-0 w-full flex-col">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="inline-flex h-2 w-2 rounded-full bg-[rgb(var(--accent))] shadow-[0_0_10px_rgba(167,139,250,0.75)]" />
          <div className="text-[13px] font-semibold text-white">Aurora Agent</div>
          <Pill tone={mode === "cloud" ? "primary" : "neutral"}>
            {mode === "cloud" ? "Cloud · B站" : "Local · 曲库"}
          </Pill>
          <div className="ml-auto text-[11px] text-[rgb(var(--fg-muted))]">
            {loading ? "响应中" : "已连接"}
          </div>
        </div>

        <div ref={listRef} className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {visibleTurns.length === 0 && !thinking ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
              <div className="mb-3 text-[15px] font-semibold text-white">回复会显示在这里</div>
              <p className="max-w-[220px] text-[12.5px] text-[rgb(var(--fg-muted))]">
                在下方播放器条中输入问题，Aurora Agent 会直接把回答投射到点云右侧。
              </p>
            </div>
          ) : (
            <>
              {visibleTurns.map((turn) => (
                <Message key={turn.id} turn={turn} />
              ))}
              {thinking ? <StageThinking /> : null}
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

function StageThinking() {
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

function FloorLights({ playing }: { playing: boolean }) {
  const NUM_BEAMS = 80;
  const beamsRef = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    let rafId: number;
    const targets = new Float32Array(NUM_BEAMS);
    const current = new Float32Array(NUM_BEAMS);
    let beatCountdown = 0;

    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!playing) {
        for (let i = 0; i < NUM_BEAMS; i++) {
          current[i] = Math.max(0.01, current[i] - 0.03);
          const el = beamsRef.current[i];
          if (el) {
            el.style.transform = `scaleY(${current[i]})`;
            el.style.opacity = "0.1";
          }
        }
        return;
      }

      beatCountdown--;
      const isBeat = beatCountdown <= 0;
      if (isBeat) {
        // Random interval for beats
        beatCountdown = 12 + Math.random() * 20;
      }

      for (let i = 0; i < NUM_BEAMS; i++) {
        const p = i / NUM_BEAMS; // 0 (bass) to 1 (treble)
        const maxH = Math.max(0.2, 1.0 - p * 0.7);

        // Random high-frequency noise
        if (Math.random() < 0.12) {
          targets[i] = Math.random() * maxH * 0.45;
        }

        // Bass beats (left side)
        if (isBeat && p < 0.25) {
          targets[i] = 0.6 + Math.random() * 0.4;
        }

        // Snare / mid beats
        if (isBeat && p > 0.3 && p < 0.6 && Math.random() < 0.4) {
          targets[i] = 0.4 + Math.random() * 0.35;
        }

        // Fast decay on targets
        targets[i] *= 0.82;

        // Animate actual position (fast attack, steady gravity)
        if (current[i] < targets[i]) {
          current[i] += (targets[i] - current[i]) * 0.55;
        } else {
          current[i] -= 0.025;
        }

        if (current[i] < 0.02) current[i] = 0.02;
        if (current[i] > 1.0) current[i] = 1.0;

        const el = beamsRef.current[i];
        if (el) {
          el.style.transform = `scaleY(${current[i]})`;
          el.style.opacity = `${0.35 + current[i] * 0.65}`;
        }
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-32 overflow-hidden bg-gradient-to-t from-[rgba(2,6,15,0.95)] via-[rgba(2,6,15,0.5)] to-transparent md:h-48 md:pb-6">
      <div className="mx-auto flex h-full w-full max-w-[1400px] items-end justify-between px-4 opacity-90 mix-blend-screen md:px-10">
        {Array.from({ length: NUM_BEAMS }).map((_, i) => (
          <div key={i} className="relative flex h-full w-[1.5px] items-end justify-center md:w-[2px]">
            <div
              ref={(el) => {
                beamsRef.current[i] = el;
              }}
              className="w-full origin-bottom rounded-t-full bg-gradient-to-t from-[rgba(167,139,250,0.1)] via-[rgba(216,180,254,0.7)] to-white shadow-[0_0_12px_rgba(216,180,254,0.8)]"
              style={{ transform: "scaleY(0.02)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Cloud({
  positions,
  colors,
  playing,
  currentTime,
}: {
  positions: Float32Array;
  colors: Float32Array;
  playing: boolean;
  currentTime: number;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const originalPosRef = useRef<Float32Array>(positions);
  const distsRef = useRef<Float32Array>(new Float32Array());

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    originalPosRef.current = positions.slice();
    
    const dists = new Float32Array(positions.length / 3);
    let maxD = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const d = Math.sqrt(positions[i] * positions[i] + positions[i + 1] * positions[i + 1]);
      dists[i / 3] = d;
      if (d > maxD) maxD = d;
    }
    if (maxD === 0) maxD = 1;
    for (let i = 0; i < dists.length; i++) {
      dists[i] /= maxD;
    }
    distsRef.current = dists;
    
    return geo;
  }, [positions, colors]);

  useFrame((state) => {
    if (!geometry) return;
    const posAttribute = geometry.getAttribute("position") as THREE.BufferAttribute;
    const pos = posAttribute.array as Float32Array;
    const orig = originalPosRef.current;
    const dists = distsRef.current;
    
    if (pos.length !== orig.length) return;

    const t = state.clock.getElapsedTime();
    const speed = playing ? 3.0 : 0.5;
    const intensity = playing ? 0.55 : 0.05;
    const rhythmBase = currentTime * 5.6 + t * (playing ? 4.6 : 0.4);

    for (let i = 0; i < pos.length; i += 3) {
      const idx = i / 3;
      const ox = orig[i];
      const oy = orig[i + 1];
      const oz = orig[i + 2];

      const distRatio = dists[idx];
      // Activity mask: 0 at center, exponentially increasing to 1 at the far edges
      const activity = Math.pow(distRatio, 2.5);
      const edgeSpill = Math.max(0, (distRatio - 0.54) / 0.46);
      const radialLength = Math.hypot(ox, oy) || 1;
      const radialX = ox / radialLength;
      const radialY = oy / radialLength;
      const bassPulse = Math.pow(Math.max(0, Math.sin(rhythmBase * 0.92)), 8);
      const midPulse = Math.pow(Math.max(0, Math.sin(rhythmBase * 1.86 + 0.75)), 6);
      const hatPulse = Math.pow((Math.sin(rhythmBase * 4.2 + idx * 0.11) + 1) * 0.5, 2.2);
      const bandResponse = 0.72 + 0.28 * Math.sin(idx * 0.73 + ox * 1.15 - oy * 0.92);
      const beatEnergy = (bassPulse * 0.42 + midPulse * 0.22 + hatPulse * 0.08) * bandResponse * edgeSpill;
      const rhythmicBurst = beatEnergy * (0.14 + 0.12 * ((Math.sin(t * 8.8 + idx * 0.09) + 1) * 0.5));

      const wave = Math.sin(t * speed + ox * 2.5 + oy * 2.5) * intensity * activity;
      const outwardPulse = Math.sin(t * (playing ? 2.2 : 0.7) + ox * 1.7 - oy * 1.3 + idx * 0.013) * (playing ? 0.12 : 0.03) * edgeSpill + rhythmicBurst;
      const outwardDrift = Math.cos(t * (playing ? 3.4 : 1.1) + idx * 0.097) * (0.02 + beatEnergy * 0.035) * edgeSpill;
      
      const jitterStrength = playing ? 0.03 * activity + beatEnergy * 0.045 : 0;
      const jitterX = Math.sin(t * 10 + i) * jitterStrength;
      const jitterY = Math.cos(t * 11 + i) * jitterStrength;
      const jitterZ = Math.sin(t * 12 + i) * jitterStrength;
      const beatLift = beatEnergy * 0.16;

      pos[i] = ox + jitterX + radialX * (outwardPulse + outwardDrift);
      pos[i + 1] = oy + jitterY + radialY * (outwardPulse + outwardDrift);
      pos[i + 2] = oz + wave + jitterZ + beatLift;
    }
    posAttribute.needsUpdate = true;
    
    if (pointsRef.current) {
      pointsRef.current.position.y = 0;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={0.035}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function buildTextPoints(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.font = "900 180px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, "#a78bfa"); 
  gradient.addColorStop(0.5, "#22d3ee"); 
  gradient.addColorStop(1, "#ec4899"); 
  
  ctx.fillStyle = gradient;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  return parseCanvasToPoints(canvas, 3, 11);
}

function buildImagePoints(img: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  const MAX_SIZE = 300;
  const ratio = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
  canvas.width = Math.floor(img.width * ratio);
  canvas.height = Math.floor(img.height * ratio);
  
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return parseCanvasToPoints(canvas, 1, 8); 
}

function parseCanvasToPoints(canvas: HTMLCanvasElement, step: number, scale: number = 10) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  
  const width = canvas.width;
  const height = canvas.height;
  const data = ctx.getImageData(0, 0, width, height).data;
  
  const positions: number[] = [];
  const colors: number[] = [];
  
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
  
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      if (a < 15) continue;
      
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const edgeExposure = measureEdgeExposure(data, width, height, x, y, step);
      
      // Density curve: highly dense in center, sparse at edges
      const keepProbBase =
        dist < 0.28
          ? 1
          : Math.max(0.035, 1.0 - Math.pow((dist - 0.28) / 0.72, 1.48));
      const keepProb = Math.min(1, keepProbBase + edgeExposure * 0.28 + Math.max(0, dist - 0.62) * 0.18);
      if (Math.random() > keepProb) continue;
      
      // Edge scatter: randomly displace particles more at the edges
      const scatterAmount = Math.pow(dist, 2.5) * scale * 0.15;
      const jitterX = (Math.random() - 0.5) * scatterAmount;
      const jitterY = (Math.random() - 0.5) * scatterAmount;
      const jitterZ = (Math.random() - 0.5) * scatterAmount * 0.4;
      
      const microX = (Math.random() - 0.5) * (step / width) * scale * 0.5;
      const microY = (Math.random() - 0.5) * (step / height) * scale * 0.5;
      const baseX = (x / width - 0.5) * scale;
      const baseY = -(y / height - 0.5) * scale * (height / width);
      const radialLength = Math.hypot(baseX, baseY) || 1;
      const radialX = baseX / radialLength;
      const radialY = baseY / radialLength;
      const tangentX = -radialY;
      const tangentY = radialX;
      const irregular = hashNoise2D(x * 0.173, y * 0.197);
      const swirl = (hashNoise2D(x * 0.071 + 11.2, y * 0.089 + 7.4) - 0.5) * edgeExposure * scale * 0.28;
      const spill = Math.pow(Math.max(dist, edgeExposure), 2.2) * (0.18 + irregular * 0.72) * scale * 0.42;
      
      const nx = baseX + jitterX + microX + radialX * spill + tangentX * swirl;
      const ny = baseY + jitterY + microY + radialY * spill + tangentY * swirl;
      
      // Build a curved dome surface: center bulges forward, edges recede backwards.
      // dist^2 forms a smooth paraboloid in 3D space.
      const domeDepth = scale * 0.18;
      const domeZ = (1 - dist * dist) * domeDepth;
      
      // Slight luminance offset (very small) so the image still has a hint of relief.
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const lumZ = (lum - 0.5) * 0.08;
      
      const nz = domeZ + lumZ + jitterZ;
      
      positions.push(nx, ny, nz);
      colors.push(r / 255, g / 255, b / 255);

      if (edgeExposure > 0.12) {
        const overflowChance = Math.min(0.92, edgeExposure * (0.42 + irregular * 0.44) + Math.max(0, dist - 0.55) * 0.25);
        const overflowCopies = edgeExposure > 0.46 ? 3 : edgeExposure > 0.24 ? 2 : 1;
        for (let copy = 0; copy < overflowCopies; copy++) {
          if (Math.random() >= overflowChance) continue;
          const overflowDistance = spill * (0.75 + Math.random() * 1.95) + edgeExposure * scale * (0.1 + copy * 0.035);
          const overflowSpread = (Math.random() - 0.5) * edgeExposure * scale * (0.4 + copy * 0.08);
          positions.push(
            nx + radialX * overflowDistance + tangentX * overflowSpread,
            ny + radialY * overflowDistance + tangentY * overflowSpread,
            nz + (Math.random() - 0.5) * edgeExposure * scale * 0.28
          );
          colors.push(
            Math.min(1, r / 255 * 1.08 + 0.025),
            Math.min(1, g / 255 * 1.08 + 0.025),
            Math.min(1, b / 255 * 1.1 + 0.045)
          );
        }
      }
    }
  }
  
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    count: positions.length / 3
  };
}

function measureEdgeExposure(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  step: number
) {
  const reach = Math.max(1, step * 2);
  const offsets = [
    [reach, 0],
    [-reach, 0],
    [0, reach],
    [0, -reach],
    [reach, reach],
    [reach, -reach],
    [-reach, reach],
    [-reach, -reach],
  ];
  let exposed = 0;
  for (const [ox, oy] of offsets) {
    const sx = Math.min(width - 1, Math.max(0, x + ox));
    const sy = Math.min(height - 1, Math.max(0, y + oy));
    if (data[(sy * width + sx) * 4 + 3] < 16) exposed += 1;
  }
  return exposed / offsets.length;
}

function hashNoise2D(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
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
