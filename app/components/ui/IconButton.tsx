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
      ? "bg-[rgba(167,139,250,0.20)] hover:bg-[rgba(167,139,250,0.30)] border-[rgba(167,139,250,0.45)] text-[rgb(var(--accent-strong))]"
      : tone === "ghost"
        ? "bg-transparent hover:bg-white/5 border-transparent"
        : "bg-white/5 hover:bg-white/10 border-white/10";

  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(167,139,250,0.45)] disabled:opacity-40 disabled:cursor-not-allowed",
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
