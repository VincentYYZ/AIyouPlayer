"use client";

import {
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { IconButton } from "@/app/components/ui/IconButton";

interface Props {
  disabled?: boolean;
  busy?: boolean;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
  placeholder?: string;
}

export function Composer({
  disabled,
  busy,
  onSubmit,
  onCancel,
  placeholder = "想听点什么？例如：放一首周杰伦的夜曲",
}: Props) {
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const t = value.trim();
    if (!t || disabled) return;
    onSubmit(t);
    setValue("");
    requestAnimationFrame(() => taRef.current?.focus());
  }, [value, disabled, onSubmit]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(160, el.scrollHeight) + "px";
  };

  return (
    <div className="glass-input flex items-end gap-2 px-3 py-2.5">
      <textarea
        ref={(el) => {
          taRef.current = el;
          autoResize(el);
        }}
        rows={1}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          autoResize(e.target);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="thin-scroll min-h-[24px] max-h-[160px] flex-1 resize-none bg-transparent px-1 py-1 text-[14.5px] leading-[1.55] text-white placeholder:text-[rgb(var(--fg-muted))] focus:outline-none"
      />
      {busy ? (
        <IconButton
          aria-label="停止"
          tone="default"
          size="md"
          onClick={onCancel}
          title="停止生成"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        </IconButton>
      ) : (
        <IconButton
          aria-label="发送"
          tone="primary"
          size="md"
          disabled={disabled || !value.trim()}
          onClick={submit}
          title="发送 (Enter)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </IconButton>
      )}
    </div>
  );
}
