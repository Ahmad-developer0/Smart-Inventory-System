import type { ReactNode } from "react";
import { MobileFrame } from "./MobileFrame";
import { TopAppBar } from "./TopAppBar";
import { BottomNav } from "./BottomNav";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MobileFrame>
      <TopAppBar title={title} />
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>
      <BottomNav />
    </MobileFrame>
  );
}
