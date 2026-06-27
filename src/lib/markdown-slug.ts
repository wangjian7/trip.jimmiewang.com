export function slugifyHeading(text: string) {
  let slug = text.trim();

  slug = slug.replace(/[（(]([\d.]+)[）)]/g, (_, num) => `-${num.replace(/\./g, "")}`);
  slug = slug.replace(/[（(]([^）)]+)[）)]/g, "$1");
  slug = slug.replace(/&/g, "--");
  slug = slug.replace(/\s*[·•]\s*/g, "-");
  slug = slug.replace(/[→]/g, "-");
  slug = slug.replace(/\s+/g, "");
  slug = slug.replace(/\.(?=\d)/g, "");

  return slug;
}

export function createHeadingSlugger() {
  const seen = new Map<string, number>();

  return {
    slug(text: string) {
      const base = slugifyHeading(text);
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      if (count === 0) return base;
      return `${base}-${count}`;
    },
  };
}
