// components/PageShell.tsx
import * as React from "react";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      {children}
    </div>
  );
}



