import type { ReactNode } from "react";

export function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 flex justify-center">
      <div className="w-full max-w-[420px] min-h-screen bg-background relative shadow-sm flex flex-col">
        {children}
      </div>
    </div>
  );
}
