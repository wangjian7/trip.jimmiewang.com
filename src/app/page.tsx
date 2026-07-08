import Link from "next/link";
import { trips } from "@/lib/trips";

function formatTripDateRange(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const format = (date: Date) =>
    `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, "0")}月${String(
      date.getDate(),
    ).padStart(2, "0")}日`;
  return `${format(start)} - ${format(end)}`;
}

function getHomeCardTheme(slug: string) {
  if (slug === "au-2026-09-30") return "sydney";
  if (slug === "dali-06-18") return "green";
  return "default";
}

export default function Home() {
  const sortedTrips = [...trips].sort((a, b) => a.startDate.localeCompare(b.startDate));

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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/flights/"
            data-vv-card-theme="sky"
            className="vv-card vv-home-card group rounded-[24px] p-6 transition hover:-translate-y-0.5 hover:shadow-2xl"
          >
            <div className="flex flex-col gap-2">
              <div className="vv-kicker text-xs font-medium tracking-wider">
                Flight Tracking
              </div>
              <div className="text-lg font-semibold leading-7">
                航班关注看板
              </div>
              <div className="vv-muted text-sm">
                长期盯几条航线，观察价格变化
              </div>
              <div className="vv-link mt-2 inline-flex items-center gap-2 text-sm font-medium">
                打开看板
                <span aria-hidden>→</span>
              </div>
            </div>
          </Link>
        </section>

        <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedTrips.map((trip) => (
            <Link
              key={trip.slug}
              href={`/trips/${trip.slug}/`}
              data-vv-card-theme={getHomeCardTheme(trip.slug)}
              className="vv-card vv-home-card group rounded-[24px] p-6 transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <div className="flex flex-col gap-2">
                <div className="vv-kicker text-xs font-medium tracking-wider">
                  {formatTripDateRange(trip.startDate, trip.endDate)}
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
