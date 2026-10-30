import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]",
        info: "bg-sky-500/15 text-sky-300",
        success: "bg-emerald-500/15 text-emerald-300",
        warning: "bg-[var(--color-warning)]/15 text-yellow-200",
        danger: "bg-[var(--color-destructive)]/15 text-red-300",
        muted: "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
