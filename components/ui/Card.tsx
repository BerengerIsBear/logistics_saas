// components/ui/Card.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: Props) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-white/10 bg-white text-neutral-900 shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        className
      )}
      {...props}
    />
  );
}


export function CardHeader({ className, ...props }: Props) {
  return (
    <div
      className={cn("border-b border-neutral-200 px-6 py-4", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: Props) {
  return <div className={cn("px-6 py-4", className)} {...props} />;
}

