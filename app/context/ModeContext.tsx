"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AppMode } from "@/app/lib/types";

interface ModeCtx {
  mode: AppMode;
  setMode: (m: AppMode) => void;
  toggle: () => void;
}

const Ctx = createContext<ModeCtx | null>(null);
const STORAGE_KEY = "aiyou.mode";

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<AppMode>("local");

  // 启动时读取本地存储
  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === "local" || v === "cloud") setModeState(v);
  }, []);

  const setMode = useCallback((m: AppMode) => {
    setModeState(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, m);
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "local" ? "cloud" : "local");
  }, [mode, setMode]);

  const value = useMemo<ModeCtx>(() => ({ mode, setMode, toggle }), [mode, setMode, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMode(): ModeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMode must be used within ModeProvider");
  return v;
}
