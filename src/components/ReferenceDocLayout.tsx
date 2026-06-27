"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { TocItem } from "@/lib/markdown-toc";

type TocContextValue = {
  activeId: string;
  navigate: (id: string) => void;
};

const TocContext = createContext<TocContextValue | null>(null);

function scrollToHeading(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

function useTocController(items: TocItem[]) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;

    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (hash && items.some((item) => item.id === hash)) {
      setActiveId(hash);
      requestAnimationFrame(() => scrollToHeading(hash));
    }

    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );
        const nextId = visible[0]?.target.id;
        if (nextId) setActiveId(nextId);
      },
      { rootMargin: "-88px 0px -65% 0px", threshold: [0, 0.1, 1] },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [items]);

  function navigate(id: string) {
    scrollToHeading(id);
    setActiveId(id);
  }

  return { activeId, navigate };
}

function TocLink({
  item,
  active,
  compact = false,
}: {
  item: TocItem;
  active: boolean;
  compact?: boolean;
}) {
  const ctx = useContext(TocContext);
  if (!ctx) return null;

  return (
    <button
      type="button"
      onClick={() => ctx.navigate(item.id)}
      className={[
        "vv-reference-toc-link w-full text-left transition",
        compact ? "shrink-0 rounded-full px-3 py-1.5 text-xs" : "rounded-xl px-3 py-2 text-sm",
        active ? "vv-reference-toc-link-active" : "vv-reference-toc-link-idle",
      ].join(" ")}
    >
      {item.title}
    </button>
  );
}

function TocMobileBar({ items }: { items: TocItem[] }) {
  const ctx = useContext(TocContext);
  if (!ctx || items.length === 0) return null;

  return (
    <nav
      aria-label="页面目录"
      className="vv-reference-toc-mobile sticky top-0 z-20 -mx-2 mb-6 border-b px-2 py-3 backdrop-blur-xl sm:-mx-4 sm:px-4 xl:hidden"
    >
      <div className="vv-kicker mb-2 text-[10px] font-medium tracking-[0.18em]">
        目录
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <TocLink
            key={item.id}
            item={item}
            active={ctx.activeId === item.id}
            compact
          />
        ))}
      </div>
    </nav>
  );
}

function TocSidebar({ items }: { items: TocItem[] }) {
  const ctx = useContext(TocContext);
  if (!ctx || items.length === 0) return null;

  return (
    <nav
      aria-label="页面目录"
      className="vv-reference-toc-panel max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[24px] p-4"
    >
      <div className="vv-kicker mb-3 text-[10px] font-medium tracking-[0.18em]">
        目录
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <TocLink item={item} active={ctx.activeId === item.id} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ReferenceDocLayout({
  toc,
  children,
}: {
  toc: TocItem[];
  children: ReactNode;
}) {
  const controller = useTocController(toc);

  return (
    <TocContext.Provider value={controller}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] xl:gap-10">
        <div className="min-w-0">
          <TocMobileBar items={toc} />
          {children}
        </div>
        <aside className="sticky top-6 z-10 hidden h-fit self-start xl:block">
          <TocSidebar items={toc} />
        </aside>
      </div>
    </TocContext.Provider>
  );
}
