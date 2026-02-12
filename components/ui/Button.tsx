// components/ui/Button.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "outlineOnDark";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const base =
  "rounded-md border px-4 py-2 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed";

const styles: Record<Variant, string> = {
  // Dark filled button (works anywhere)
  primary: "border-neutral-900 bg-neutral-900 text-white shadow-sm hover:bg-black",

  // ✅ Default outline for WHITE cards (always dark text)
  outline: "border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",

  // ✅ Outline for DARK surfaces (transparent + light text)
  outlineOnDark: "border-white/30 bg-white/5 text-white hover:bg-white/10",
};

export function Button({ className, variant = "outline", ...props }: Props) {
  return <button className={cn(base, styles[variant], className)} {...props} />;
}

