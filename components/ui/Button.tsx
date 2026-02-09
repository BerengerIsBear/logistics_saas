// components/ui/Button.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outlineDark" | "outline" | "ghost";
type Size = "sm" | "md";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-200 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-neutral-900 text-white shadow-sm hover:bg-black",
  outlineDark: "border border-white/30 bg-white/5 text-white hover:bg-white/10",
  outline: "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
  ghost: "text-neutral-700 hover:bg-neutral-100",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3",
  md: "h-10 px-4",
};

export function Button({
  className,
  variant = "outline",
  size = "md",
  ...props
}: Props) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
