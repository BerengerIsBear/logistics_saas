// components/ui/Input.tsx
import * as React from "react";
import { cn } from "@/lib/cn";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400",
        "focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-200",
        className
      )}
      {...props}
    />
  );
}

