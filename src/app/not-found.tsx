import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-20 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="text-2xl font-semibold tracking-tight">页面不存在</div>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          这个行程可能还没创建或链接写错了。
        </p>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}

