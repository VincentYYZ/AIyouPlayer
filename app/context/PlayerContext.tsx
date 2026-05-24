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
import type { AudioTrack } from "@/app/lib/types";

interface PlayerCtx {
  /** 播放队列 */
  queue: AudioTrack[];
  /** 当前在播索引（-1 表示无） */
  currentIdx: number;
  /** 当前曲目 */
  current: AudioTrack | null;
  /** 是否在播放 */
  playing: boolean;
  /** 当前秒数 */
  currentTime: number;
  /** 总时长秒 */
  duration: number;
  /** 静音 */
  muted: boolean;
  /** 0-1 */
  volume: number;
  /** 把一组曲目加入队列；若 autoplay 为 true 则把第一首设为当前并播放 */
  addToQueue: (tracks: AudioTrack[], opts?: { autoplay?: boolean }) => void;
  /** 替换整个队列 */
  setQueue: (tracks: AudioTrack[]) => void;
  /** 直接播放某曲目（若不在队列则插入末尾） */
  playTrack: (track: AudioTrack) => void;
  /** 暂停/恢复 */
  togglePlay: () => void;
  /** 上/下一首 */
  next: () => void;
  prev: () => void;
  /** 拖动到某秒 */
  seek: (sec: number) => void;
  /** 音量 0-1 */
  setVolume: (v: number) => void;
  /** 切换静音 */
  toggleMute: () => void;
  /** 移除某曲目 */
  removeFromQueue: (id: string) => void;
  /** 注册供 UI 使用的 audio 引用（内部） */
  attachAudio: (el: HTMLAudioElement | null) => void;
}

const Ctx = createContext<PlayerCtx | null>(null);

function sameId(a?: AudioTrack | null, b?: AudioTrack | null): boolean {
  return !!a && !!b && a.id === b.id;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueueState] = useState<AudioTrack[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(-1);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.85);
  const [muted, setMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const current = currentIdx >= 0 && currentIdx < queue.length ? queue[currentIdx] : null;

  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
  }, []);

  // 同步音量与播放
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;
    el.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!current) {
      el.pause();
      return;
    }
    if (el.src !== current.url) {
      el.src = current.url;
      el.currentTime = 0;
    }
    if (playing) {
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [current, playing]);

  const togglePlay = useCallback(() => {
    if (currentIdx < 0 && queue.length > 0) {
      setCurrentIdx(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [currentIdx, queue.length]);

  const next = useCallback(() => {
    setCurrentIdx((i) => {
      if (queue.length === 0) return -1;
      return i + 1 < queue.length ? i + 1 : 0;
    });
    setPlaying(true);
  }, [queue.length]);

  const prev = useCallback(() => {
    setCurrentIdx((i) => {
      if (queue.length === 0) return -1;
      return i - 1 >= 0 ? i - 1 : queue.length - 1;
    });
    setPlaying(true);
  }, [queue.length]);

  const seek = useCallback((sec: number) => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(sec)) return;
    el.currentTime = Math.max(0, Math.min(sec, el.duration || 0));
    setCurrentTime(el.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamp = Math.max(0, Math.min(1, v));
    setVolumeState(clamp);
    if (clamp > 0) setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  const addToQueue = useCallback<PlayerCtx["addToQueue"]>(
    (tracks, opts) => {
      if (!tracks.length) return;
      setQueueState((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        const fresh = tracks.filter((t) => !seen.has(t.id));
        const next = [...prev, ...fresh];
        if (opts?.autoplay && fresh.length > 0) {
          const targetId = fresh[0].id;
          const idx = next.findIndex((t) => t.id === targetId);
          setCurrentIdx(idx);
          setPlaying(true);
        } else if (prev.length === 0 && next.length > 0) {
          setCurrentIdx(0);
        }
        return next;
      });
    },
    []
  );

  const replaceQueue = useCallback<PlayerCtx["setQueue"]>((tracks) => {
    setQueueState(tracks);
    setCurrentIdx(tracks.length > 0 ? 0 : -1);
    setPlaying(false);
  }, []);

  const playTrack = useCallback<PlayerCtx["playTrack"]>((track) => {
    setQueueState((prev) => {
      const idx = prev.findIndex((t) => sameId(t, track));
      if (idx >= 0) {
        setCurrentIdx(idx);
        setPlaying(true);
        return prev;
      }
      const next = [...prev, track];
      setCurrentIdx(next.length - 1);
      setPlaying(true);
      return next;
    });
  }, []);

  const removeFromQueue = useCallback<PlayerCtx["removeFromQueue"]>((id) => {
    setQueueState((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx < 0) return prev;
      const next = prev.filter((t) => t.id !== id);
      setCurrentIdx((cur) => {
        if (next.length === 0) {
          setPlaying(false);
          return -1;
        }
        if (cur === idx) return Math.min(idx, next.length - 1);
        if (cur > idx) return cur - 1;
        return cur;
      });
      return next;
    });
  }, []);

  // 监听 audio 元素事件（在 Player 组件里挂载）
  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    setDuration(el.duration || 0);
  }, []);

  const handleEnded = useCallback(() => {
    next();
  }, [next]);

  // 暴露事件 handler 给底层组件挂在 audio 元素上
  const handlersRef = useRef({ handleTimeUpdate, handleEnded });
  handlersRef.current = { handleTimeUpdate, handleEnded };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => handlersRef.current.handleTimeUpdate();
    const onEnd = () => handlersRef.current.handleEnded();
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("durationchange", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("durationchange", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [audioRef.current]);

  const value = useMemo<PlayerCtx>(
    () => ({
      queue,
      currentIdx,
      current,
      playing,
      currentTime,
      duration,
      volume,
      muted,
      addToQueue,
      setQueue: replaceQueue,
      playTrack,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      removeFromQueue,
      attachAudio,
    }),
    [
      queue,
      currentIdx,
      current,
      playing,
      currentTime,
      duration,
      volume,
      muted,
      addToQueue,
      replaceQueue,
      playTrack,
      togglePlay,
      next,
      prev,
      seek,
      setVolume,
      toggleMute,
      removeFromQueue,
      attachAudio,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayer(): PlayerCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
}
