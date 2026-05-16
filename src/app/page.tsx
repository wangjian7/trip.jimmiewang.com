import Link from "next/link";
import { trips } from "@/lib/trips";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-14">
        <header className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Trip Board
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            用一个统一的页面，和同伴一起维护行程。当前版本为纯静态站点：编辑内容会保存在浏览器本地，可导出/导入 JSON 进行同步。
          </p>
        </header>

        <main className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link
              key={trip.slug}
              href={`/trips/${trip.slug}/`}
              className="group rounded-[24px] border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-col gap-2">
                <div className="text-xs font-medium tracking-wider text-zinc-500 dark:text-zinc-400">
                  TRIP
                </div>
                <div className="text-lg font-semibold leading-7">
                  {trip.title}
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {trip.subtitle ?? `${trip.days.length} 天`}
                </div>
                <div className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-50">
                  打开行程
                  <span aria-hidden>→</span>
                </div>
              </div>
            </Link>
          ))}
        </main>

        <footer className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          想做到“大家实时共同编辑并自动同步”，需要引入 Cloudflare 的持久化能力（例如 D1/KV + Worker）。后续随时可以升级。
        </footer>
      </div>
    </div>
  );
}
