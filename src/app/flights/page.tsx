import { FlightWatchBoard } from "@/components/FlightWatchBoard";

export default function FlightsPage() {
  return (
    <div className="flex flex-1 flex-col bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-14">
        <FlightWatchBoard />
      </div>
    </div>
  );
}
