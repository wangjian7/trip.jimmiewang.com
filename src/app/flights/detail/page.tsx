import { Suspense } from "react";
import { FlightWatchDetailPanel } from "@/components/FlightWatchDetailPanel";

export default function FlightWatchDetailPage() {
  return (
    <div className="flex flex-1 flex-col bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-14">
        <Suspense fallback={<p className="vv-muted text-sm">加载详情…</p>}>
          <FlightWatchDetailPanel />
        </Suspense>
      </div>
    </div>
  );
}
