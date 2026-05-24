"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDanmaku } from "@/app/context/DanmakuContext";
import { usePlayer } from "@/app/context/PlayerContext";
import type { DanmakuItem } from "@/app/lib/types";

const SCROLL_DURATION = 12;
const LOOKAHEAD = 0.3;
const ROWS = 7;
const TOP_MIN = 8;
const TOP_MAX = 78;

type ActiveDanmaku = {
  item: DanmakuItem;
  spawnId: number;
  top: number;
  duration: number;
  opacity: number;
  fontSize: string;
};

let spawnIdCounter = 0;

/**
 * 简化版弹幕覆层：
 * 把 visibleItems 里每条弹幕按 hash 分配到 4 行轨道，让其匀速从右向左飘过。
 */
 export function DanmakuOverlay() {
  const { enabled, items } = useDanmaku();
  const { currentTime } = usePlayer();
  const [active, setActive] = useState<ActiveDanmaku[]>([]);
  const lastTimeRef = useRef(0);
  const lastIndexRef = useRef(0);
  const rowCursorRef = useRef(0);
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const orderedItems = useMemo(
    () => [...items].sort((a, b) => a.time - b.time || Math.abs(hash(a.text)) - Math.abs(hash(b.text))),
    [items]
  );

  const clearActive = useCallback(() => {
    for (const timer of timeoutsRef.current) {
      clearTimeout(timer);
    }
    timeoutsRef.current = [];
    setActive([]);
  }, []);

  const spawnDanmaku = useCallback((item: DanmakuItem) => {
    const spawnId = ++spawnIdCounter;
    const textHash = Math.abs(hash(item.text));
    const rowGap = ROWS > 1 ? (TOP_MAX - TOP_MIN) / (ROWS - 1) : 0;
    const row = rowCursorRef.current % ROWS;
    rowCursorRef.current += 1;
    const jitter = ((((textHash >> 2) % 1000) / 1000) - 0.5) * Math.min(2.8, rowGap * 0.24 + 0.8);
    const top = clamp(TOP_MIN + row * rowGap + jitter, TOP_MIN, TOP_MAX);
    const duration = SCROLL_DURATION + ((textHash >> 4) % 4) * 0.5;
    const opacity = 0.82 + (((textHash >> 5) % 100) / 100) * 0.12;
    const fontSize = item.size === "large" ? "15px" : item.size === "small" ? "11.5px" : "12.5px";

    setActive((prev) => [...prev, { item, spawnId, top, duration, opacity, fontSize }]);

    const timer = setTimeout(() => {
      setActive((prev) => prev.filter((entry) => entry.spawnId !== spawnId));
      timeoutsRef.current = timeoutsRef.current.filter((entry) => entry !== timer);
    }, duration * 1000 + 500);
    timeoutsRef.current.push(timer);
  }, []);

  useEffect(() => {
    return () => clearActive();
  }, [clearActive]);

  useEffect(() => {
    if (!enabled || orderedItems.length === 0) {
      clearActive();
      lastIndexRef.current = 0;
      rowCursorRef.current = 0;
      lastTimeRef.current = currentTime;
      return;
    }

    const delta = currentTime - lastTimeRef.current;
    const seeked = delta < -1 || delta > 3;
    lastTimeRef.current = currentTime;

    if (seeked) {
      clearActive();
      rowCursorRef.current = 0;
      if (currentTime <= 0) {
        lastIndexRef.current = 0;
        return;
      }
      const resumeIdx = orderedItems.findIndex((item) => item.time >= currentTime - LOOKAHEAD);
      lastIndexRef.current = resumeIdx < 0 ? orderedItems.length : resumeIdx;
    }

    const target = currentTime + LOOKAHEAD;
    let idx = lastIndexRef.current;
    while (idx < orderedItems.length && orderedItems[idx]!.time <= target) {
      spawnDanmaku(orderedItems[idx]!);
      idx += 1;
    }
    lastIndexRef.current = idx;
  }, [currentTime, enabled, orderedItems, spawnDanmaku, clearActive]);

  if (!enabled || orderedItems.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {active.map(({ item, top, duration, opacity, fontSize, spawnId }) => (
        <span
          key={spawnId}
          className="absolute left-0 whitespace-nowrap font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          style={{
            top: `${top}%`,
            color: item.color ? `#${item.color.toString(16).padStart(6, "0")}` : "white",
            fontSize,
            animation: `dm-fly ${duration}s linear forwards`,
            opacity,
          }}
        >
          {item.text}
        </span>
      ))}
      <style>{`
        @keyframes dm-fly {
          0% { transform: translate3d(100vw, 0, 0); }
          100% { transform: translate3d(-120%, 0, 0); }
        }
      `}</style>
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
