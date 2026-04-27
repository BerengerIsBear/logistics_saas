// components/ui/Select.tsx
import * as React from "react";

type Props = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className = "", ...props }: Props) {
  return (
    <div className="relative">
      <select
        className={[
          "h-10 w-full rounded-md border border-neutral-200 bg-white",
          "px-3 pr-12 text-sm text-neutral-900",
          "outline-none focus:ring-2 focus:ring-neutral-200",
          "appearance-none",
          className,
        ].join(" ")}
        {...props}
      />

      {/* Arrow */}
      <svg
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}


