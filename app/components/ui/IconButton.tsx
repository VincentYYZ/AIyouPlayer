"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** "default" 玻璃态；"primary" 强调色 */
  tone?: "default" | "primary" | "ghost";
  size?: "sm" | "md" | "lg";
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-8 w-8 text-[13px]",
  md: "h-10 w-10 text-[15px]",
  lg: "h-12 w-12 text-[17px]",
};

export function IconButton({
  children,
  tone = "default",
  size = "md",
  className,
  ...rest
}: Props) {
  const toneCls =
    tone === "primary"
      ? "bg-[rgba(255,58,177,0.18)] hover:bg-[rgba(255,58,177,0.28)] border-[rgba(0,229,255,0.34)] text-white shadow-[0_0_18px_rgba(255,58,177,0.26)]"
      : tone === "ghost"
        ? "bg-transparent hover:bg-[rgba(0,229,255,0.08)] border-transparent"
        : "bg-black/25 hover:bg-[rgba(0,229,255,0.10)] border-[rgba(0,229,255,0.14)]";

  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,58,177,0.45)] disabled:opacity-40 disabled:cursor-not-allowed",
        SIZE[size],
        toneCls,
        className ?? "",
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
