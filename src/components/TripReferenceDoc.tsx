import Link from "next/link";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ReferenceDocLayout } from "@/components/ReferenceDocLayout";
import type { TocItem } from "@/lib/markdown-toc";

const toolbarGhostClass =
  "vv-toolbar-btn vv-toolbar-btn-ghost inline-flex items-center justify-center gap-2.5 rounded-xl px-5 text-sm font-medium shadow-sm";

function getReferenceTheme(slug: string) {
  if (slug === "au-2026-09-30") return "sydney";
  return "default";
}

export function TripReferenceDoc({
  slug,
  title,
  subtitle,
  content,
  toc,
}: {
  slug: string;
  title: string;
  subtitle?: string;
  content: string;
  toc: TocItem[];
}) {
  const theme = getReferenceTheme(slug);

  return (
    <div className="vv-reference-page flex-1 bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="vv-reference-hero pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_20%_20%,rgba(0,112,235,0.12),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(172,99,0,0.14),transparent_50%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(90,167,255,0.12),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(255,184,116,0.1),transparent_50%)]" />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <Link href={`/trips/${slug}/`} className={toolbarGhostClass}>
              <span
                aria-hidden="true"
                className="vv-toolbar-btn__icon inline-flex h-5 w-5 items-center justify-center"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
                  <path
                    d="M7 4v4.2c0 1.3 1 2.3 2.3 2.3H16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 4 4 7m3-3 3 3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 10.5v2.3A3.2 3.2 0 0 1 12.8 16H6.6A2.6 2.6 0 0 1 4 13.4V7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              返回行程
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            <div className="vv-kicker text-xs font-medium tracking-[0.18em]">
              REFERENCE DOC
            </div>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="vv-muted max-w-2xl text-base leading-7">{subtitle}</p>
            ) : null}
          </div>
        </header>

        <ReferenceDocLayout toc={toc}>
          <div className="flex flex-col gap-8">
            <article
              className="vv-markdown vv-panel vv-reference-doc rounded-[28px] p-6 sm:p-10"
              data-vv-theme={theme}
            >
              <MarkdownContent content={content} />
            </article>

            <footer className="vv-muted pb-4 text-xs leading-6">
              Powered by{" "}
              <a
                className="vv-link font-medium"
                href="https://jimmiewang.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                jimmiewang.com
              </a>
            </footer>
          </div>
        </ReferenceDocLayout>
      </div>
    </div>
  );
}
