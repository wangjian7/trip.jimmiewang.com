import { createHeadingSlugger } from "@/lib/markdown-slug";

export type TocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

const SKIP_TOC_TITLES = new Set(["快速导航"]);

export function stripQuickNavSection(content: string) {
  return content.replace(/## 快速导航\s*\n[\s\S]*?(?=\n---\n)/, "").trimStart();
}

export function extractMarkdownToc(content: string, levels: Array<2 | 3> = [2]) {
  const slugger = createHeadingSlugger();
  const items: TocItem[] = [];

  for (const line of content.split("\n")) {
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      const title = h2[1].trim();
      if (SKIP_TOC_TITLES.has(title)) continue;
      if (levels.includes(2)) {
        items.push({ id: slugger.slug(title), title, level: 2 });
      }
      continue;
    }

    const h3 = line.match(/^### (.+)$/);
    if (h3 && levels.includes(3)) {
      const title = h3[1].trim();
      items.push({ id: slugger.slug(title), title, level: 3 });
    }
  }

  return items;
}

export function prepareReferenceMarkdown(content: string) {
  const body = stripQuickNavSection(content);
  return {
    body,
    toc: extractMarkdownToc(body),
  };
}
