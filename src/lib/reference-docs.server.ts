import fs from "node:fs";
import path from "node:path";
import { REFERENCE_DOCS } from "@/lib/reference-docs";

export function getReferenceDocContent(slug: string) {
  const filename = REFERENCE_DOCS[slug];
  if (!filename) return null;

  const filePath = path.join(process.cwd(), "assets", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const subtitleMatch = raw.match(/^>\s+(.+)$/m);
  const content = raw
    .replace(/^#\s[^\n]+\n+/, "")
    .replace(/^>\s[^\n]+\n+/, "")
    .replace(/^---\n+/, "");

  return {
    title: titleMatch?.[1] ?? "参考文档",
    subtitle: subtitleMatch?.[1],
    content,
  };
}
