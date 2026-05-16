import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center bg-[color:var(--background)] px-6 py-20 text-[color:var(--foreground)]">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="text-2xl font-semibold tracking-tight">页面不存在</div>
        <p className="vv-muted text-sm leading-6">
          这个行程可能还没创建或链接写错了。
        </p>
        <Link
          href="/"
          className="vv-btn-primary inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium shadow-sm"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
