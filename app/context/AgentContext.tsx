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
import { useMode } from "@/app/context/ModeContext";
import { usePlayer } from "@/app/context/PlayerContext";
import { useSSE } from "@/app/hooks/useSSE";
import type {
  AppMode,
  AudioTrack,
  ChatTurn,
  ConvertJob,
} from "@/app/lib/types";
import {
  extractAddedFromText,
  extractTracksFromText,
} from "@/app/lib/parseTracks";

interface AgentCtx {
  turns: ChatTurn[];
  loading: boolean;
  /** 模型流式输出过程中给到 UI 的"思考中"指示 */
  thinking: boolean;
  send: (text: string, options?: { mode?: AppMode }) => Promise<void>;
  cancel: () => void;
  /** 把若干 BV 加入后台转换队列（云端模式下点击 ADD 用） */
  enqueueDownloads: (bvids: string[]) => void;
  /** 已知的转换任务状态，按 bvid 分组 */
  jobByBvid: Map<string, ConvertJob>;
  /** Agent 回复面板是否展开（点击搜索框时展开，点击外部收起） */
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
}

const Ctx = createContext<AgentCtx | null>(null);

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const { mode } = useMode();
  const { addToQueue } = usePlayer();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [thinking, setThinking] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  // 对话历史的镜像，便于发送时附带 minimal context
  const turnsRef = useRef<ChatTurn[]>(turns);
  turnsRef.current = turns;

  // 后台任务跟踪
  const [jobs, setJobs] = useState<Record<string, ConvertJob>>({});
  const handledRef = useRef<Set<string>>(new Set());

  const baseBody = useMemo(() => ({ mode }), [mode]);

  const appendTurn = useCallback((turn: ChatTurn) => {
    setTurns((prev) => [...prev, turn]);
  }, []);

  const consumeAssistantText = useCallback(
    (text: string) => {
      // 先抽 added，再抽 tracks
      const added = extractAddedFromText(text);
      const tracksRes = extractTracksFromText(added.cleanedText);

      const finalText = tracksRes.cleanedText.trim();

      // BV 候选项：只有 bvid、没有本地 url，需要用户点 ADD 才下载
      const bvCandidates = tracksRes.tracks.filter(
        (t) => t.bvid && (!t.url || !t.url.startsWith("/api/audio"))
      );

      if (finalText || bvCandidates.length > 0) {
        appendTurn({
          id: newId(),
          role: "assistant",
          content: finalText,
          ts: Date.now(),
          ...(bvCandidates.length > 0 ? { tracksCandidates: bvCandidates } : {}),
        });
      }

      // 直接可播的曲目（本地 url 或已经在 added 块里的）
      const playable: AudioTrack[] = [
        ...added.tracks,
        ...tracksRes.tracks.filter((t) => t.url && t.url.startsWith("/api/audio")),
      ];
      if (playable.length > 0) {
        addToQueue(playable);
        appendTurn({
          id: newId(),
          role: "system",
          content: `已加入播放队列：${playable.map((t) => t.title).join(" / ")}`,
          ts: Date.now(),
        });
      }
    },
    [addToQueue, appendTurn]
  );

  const handleSseEvent = useCallback(
    ({ event, data }: { event: string; data: unknown }) => {
      if (event === "status") return;
      if (event === "error") {
        appendTurn({
          id: newId(),
          role: "system",
          content: typeof data === "string" ? data : JSON.stringify(data),
          ts: Date.now(),
        });
        setThinking(false);
        return;
      }
      if (event === "done") {
        setThinking(false);
        return;
      }
      if (event !== "output" || !data || typeof data !== "object") return;

      const payload = data as Record<string, unknown>;
      const type = payload.type as string | undefined;

      if (type === "assistant") {
        const message = payload.message as { content?: unknown } | undefined;
        const content = message?.content;
        if (!Array.isArray(content)) return;
        for (const block of content as Array<Record<string, unknown>>) {
          if (block.type === "text" && typeof block.text === "string") {
            consumeAssistantText(block.text);
          } else if (block.type === "tool_use" && typeof block.name === "string") {
            const summary =
              block.input !== undefined
                ? `${block.name} ${safeStringify(block.input).slice(0, 320)}`
                : block.name;
            appendTurn({
              id: newId(),
              role: "tool",
              toolName: block.name,
              content: summary,
              ts: Date.now(),
            });
          }
        }
        return;
      }

      if (type === "result" && typeof payload.result === "string") {
        consumeAssistantText(payload.result);
      }
    },
    [appendTurn, consumeAssistantText]
  );

  const { send, cancel, loading } = useSSE({
    url: "/api/chat",
    baseBody,
    onEvent: handleSseEvent,
  });

  const sendMessage = useCallback(
    async (text: string, options?: { mode?: AppMode }) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      appendTurn({
        id: newId(),
        role: "user",
        content: trimmed,
        ts: Date.now(),
      });
      setThinking(true);
      const recentHistory = turnsRef.current
        .filter((t) => t.role === "user" || t.role === "assistant")
        .slice(-30)
        .map((t) => ({ role: t.role, content: t.content }));
      await send(trimmed, {
        history: recentHistory,
        ...(options?.mode ? { mode: options.mode } : {}),
      });
    },
    [appendTurn, send]
  );

  // 后台转换任务
  const enqueueDownloads = useCallback(
    (bvids: string[]) => {
      const fresh = bvids.map((b) => b.trim()).filter(Boolean);
      if (!fresh.length) return;
      void (async () => {
        try {
          const res = await fetch("/api/bili/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bvids: fresh }),
          });
          const data = (await res.json()) as { jobs?: ConvertJob[]; error?: string };
          if (!res.ok || !data.jobs) {
            throw new Error(data.error || `convert HTTP ${res.status}`);
          }
          setJobs((prev) => {
            const next = { ...prev };
            for (const j of data.jobs!) next[j.bvid] = j;
            return next;
          });
          appendTurn({
            id: newId(),
            role: "system",
            content: `已开始下载 ${data.jobs.length} 项：${data.jobs.map((j) => j.bvid).join(", ")}`,
            ts: Date.now(),
          });
        } catch (err) {
          appendTurn({
            id: newId(),
            role: "system",
            content: `下载排队失败：${String(err)}`,
            ts: Date.now(),
          });
        }
      })();
    },
    [appendTurn]
  );

  // 任务轮询：只要还有未完成任务就持续 2s 轮询
  useEffect(() => {
    const pendingIds = Object.values(jobs)
      .filter((j) => j.status === "queued" || j.status === "running")
      .map((j) => j.id);
    if (pendingIds.length === 0) return;

    const tick = async () => {
      try {
        const params = new URLSearchParams();
        for (const id of pendingIds) params.append("jobId", id);
        const res = await fetch(`/api/bili/convert?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as { jobs?: ConvertJob[] };
        if (!Array.isArray(data.jobs)) return;
        setJobs((prev) => {
          const next = { ...prev };
          for (const j of data.jobs!) next[j.bvid] = j;
          return next;
        });
        // 处理刚完成/失败的
        for (const j of data.jobs) {
          if (handledRef.current.has(j.id)) continue;
          if (j.status === "completed") {
            handledRef.current.add(j.id);
            if (j.tracks.length > 0) {
              addToQueue(j.tracks);
              appendTurn({
                id: newId(),
                role: "system",
                content: `转换完成：${j.tracks.map((t) => t.title).join(" / ")}`,
                ts: Date.now(),
              });
            }
          } else if (j.status === "failed") {
            handledRef.current.add(j.id);
            appendTurn({
              id: newId(),
              role: "system",
              content: `转换失败 ${j.bvid}：${j.error ?? "未知错误"}`,
              ts: Date.now(),
            });
          }
        }
      } catch {
        // ignore
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => window.clearInterval(timer);
  }, [jobs, addToQueue, appendTurn]);

  const jobByBvid = useMemo(() => {
    const map = new Map<string, ConvertJob>();
    for (const [bv, j] of Object.entries(jobs)) map.set(bv, j);
    return map;
  }, [jobs]);

  const value = useMemo<AgentCtx>(
    () => ({
      turns,
      loading,
      thinking: thinking && loading,
      send: sendMessage,
      cancel,
      enqueueDownloads,
      jobByBvid,
      panelOpen,
      openPanel,
      closePanel,
    }),
    [turns, loading, thinking, sendMessage, cancel, enqueueDownloads, jobByBvid, panelOpen, openPanel, closePanel]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function useAgent(): AgentCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgent must be used within AgentProvider");
  return v;
}
