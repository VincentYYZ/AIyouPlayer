"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SSEEvent {
  event: string;
  data: unknown;
}

interface UseSSEOptions {
  /** POST 端点 URL */
  url: string;
  /** 每次请求都会带上的 body 基础字段 */
  baseBody?: Record<string, unknown>;
  /** 收到一条事件时的回调 */
  onEvent?: (e: SSEEvent) => void;
}

interface SendExtras extends Record<string, unknown> {
  history?: Array<{ role: string; content: string }>;
}

/**
 * 简单的 SSE POST hook。Next.js Route Handler 支持以 ReadableStream 返回 text/event-stream，
 * 这里我们用 fetch + ReadableStream reader 做最小实现，避免 EventSource 不支持 POST 的限制。
 */
export function useSSE({ url, baseBody, onEvent }: UseSSEOptions) {
  const [loading, setLoading] = useState(false);
  const ctrlRef = useRef<AbortController | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const cancel = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setLoading(false);
  }, []);

  const send = useCallback(
    async (message: string, extras?: SendExtras) => {
      cancel();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      setLoading(true);

      try {
        const res = await fetch(url, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(baseBody ?? {}),
            ...(extras ?? {}),
            message,
          }),
        });
        if (!res.ok || !res.body) {
          throw new Error(`HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            const evt = parseSseChunk(chunk);
            if (evt) onEventRef.current?.(evt);
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        onEventRef.current?.({ event: "error", data: String(err) });
      } finally {
        setLoading(false);
        ctrlRef.current = null;
      }
    },
    [url, baseBody, cancel]
  );

  return { send, cancel, loading };
}

function parseSseChunk(raw: string): SSEEvent | null {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trim();
  }
  if (!data) return { event, data: null };
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return { event, data };
  }
}
