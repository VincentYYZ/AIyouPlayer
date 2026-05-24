"use client";

import type { ReactNode } from "react";
import { ModeProvider } from "@/app/context/ModeContext";
import { PlayerProvider } from "@/app/context/PlayerContext";
import { DanmakuProvider } from "@/app/context/DanmakuContext";
import { AgentProvider } from "@/app/context/AgentContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ModeProvider>
      <PlayerProvider>
        <DanmakuProvider>
          <AgentProvider>{children}</AgentProvider>
        </DanmakuProvider>
      </PlayerProvider>
    </ModeProvider>
  );
}
