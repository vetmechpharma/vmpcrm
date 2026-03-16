import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary/15 text-secondary hover:bg-secondary/25",
        destructive:
          "border-transparent bg-destructive/15 text-destructive shadow hover:bg-destructive/25",
        outline: "text-foreground",
        success: "border-transparent bg-[#28C76F]/15 text-[#28C76F]",
        warning: "border-transparent bg-[#FF9F43]/15 text-[#FF9F43]",
        info: "border-transparent bg-[#00CFE8]/15 text-[#00CFE8]",
        purple: "border-transparent bg-[#1e7a4d]/15 text-[#1e7a4d]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
