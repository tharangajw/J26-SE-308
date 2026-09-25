import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-text-primary text-background hover:bg-text-primary/80",
    secondary: "border-transparent bg-surface-secondary text-text-primary hover:bg-surface-secondary/80",
    destructive: "border-transparent bg-brand-fault/20 text-brand-fault",
    outline: "text-text-primary border-border",
    success: "border-transparent bg-brand-obs/20 text-brand-obs",
    warning: "border-transparent bg-brand-perf/20 text-brand-perf",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
