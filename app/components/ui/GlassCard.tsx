"use client";

import type { HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "strong";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: Variant;
}

export function GlassCard({
  children,
  variant = "default",
  className,
  ...rest
}: Props) {
  const base = variant === "strong" ? "glass-strong" : "glass";
  return (
    <div className={[base, "p-4", className ?? ""].join(" ").trim()} {...rest}>
      {children}
    </div>
  );
}
