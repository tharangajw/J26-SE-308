import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  indicatorColor?: string;
}

export const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ className, value, max = 100, indicatorColor = "bg-text-primary", ...props }, ref) => {
    const percentage = Math.min(Math.max(value / max, 0), 1) * 100;

    return (
      <div
        ref={ref}
        className={cn("relative h-2 w-full overflow-hidden rounded-full bg-surface-secondary", className)}
        {...props}
      >
        <motion.div
          className={cn("h-full w-full flex-1 transition-all duration-500 ease-out", indicatorColor)}
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: percentage / 100 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    )
  }
)
ProgressBar.displayName = "ProgressBar"
