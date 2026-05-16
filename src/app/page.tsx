import Link from "next/link";
import { trips } from "@/lib/trips";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-14">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Trip Board
          </h1>
          <p className="vv-link max-w-2xl text-base leading-7">
            和同伴一起维护行程
          </p>
        </header>

        <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link
              key={trip.slug}
              href={`/trips/${trip.slug}/`}
              className="vv-card group rounded-[24px] p-6 transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <div className="flex flex-col gap-2">
                <div className="vv-kicker text-xs font-medium tracking-wider">
                  TRIP
                </div>
                <div className="text-lg font-semibold leading-7">
                  {trip.title}
                </div>
                <div className="vv-muted text-sm">
                  {trip.subtitle ?? `${trip.days.length} 天`}
                </div>
                <div className="vv-link mt-2 inline-flex items-center gap-2 text-sm font-medium">
                  打开行程
                  <span aria-hidden>→</span>
                </div>
              </div>
            </Link>
          ))}
        </main>

      </div>
    </div>
  );
}
