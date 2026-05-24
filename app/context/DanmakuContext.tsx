"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePlayer } from "@/app/context/PlayerContext";
import type { DanmakuItem } from "@/app/lib/types";

interface DanmakuCtx {
  enabled: boolean;
  toggle: () => void;
  /** 当前曲目对应的弹幕列表 */
  items: DanmakuItem[];
  /** 当前应当显示的弹幕窗口（按播放进度截取） */
  visibleItems: DanmakuItem[];
}

const Ctx = createContext<DanmakuCtx | null>(null);

const WINDOW_BEFORE = 0.2;
const WINDOW_AFTER = 6;
const KEEP_LAST = 25;

export function DanmakuProvider({ children }: { children: ReactNode }) {
  const { current, currentTime } = usePlayer();
  const [enabled, setEnabled] = useState(true);
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const cacheRef = useRef<Map<string, DanmakuItem[]>>(new Map());
  const lastBvidRef = useRef<string | null>(null);

  const toggle = useCallback(() => setEnabled((v) => !v), []);

  // 当前曲目变化时，按 bvid 拉弹幕
  useEffect(() => {
    const bvid = current?.bvid;
    if (!bvid) {
      setItems([]);
      lastBvidRef.current = null;
      return;
    }
    if (lastBvidRef.current === bvid) return;
    lastBvidRef.current = bvid;

    const cached = cacheRef.current.get(bvid);
    if (cached) {
      setItems(cached);
      return;
    }
    let aborted = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/bili/danmaku?bvid=${encodeURIComponent(bvid)}`
        );
        const data = (await res.json()) as { items?: DanmakuItem[] };
        if (aborted) return;
        const list = Array.isArray(data.items) ? data.items : [];
        cacheRef.current.set(bvid, list);
        setItems(list);
      } catch {
        if (!aborted) setItems([]);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [current?.bvid]);

  const visibleItems = useMemo(() => {
    if (!enabled || items.length === 0) return [];
    const from = currentTime - WINDOW_BEFORE;
    const to = currentTime + WINDOW_AFTER;
    const slice = items.filter((d) => d.time >= from && d.time <= to);
    return slice.slice(-KEEP_LAST);
  }, [enabled, items, currentTime]);

  const value = useMemo<DanmakuCtx>(
    () => ({ enabled, toggle, items, visibleItems }),
    [enabled, toggle, items, visibleItems]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDanmaku(): DanmakuCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDanmaku must be used within DanmakuProvider");
  return v;
}
