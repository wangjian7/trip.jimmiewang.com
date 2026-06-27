export const REFERENCE_DOCS: Record<string, string> = {
  "au-2026-09-30": "澳洲旅行计划.md",
};

export function getReferenceDocSlugs() {
  return Object.keys(REFERENCE_DOCS);
}

export function hasReferenceDoc(slug: string) {
  return slug in REFERENCE_DOCS;
}
