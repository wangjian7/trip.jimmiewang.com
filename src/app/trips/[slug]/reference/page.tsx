import { notFound } from "next/navigation";
import { TripReferenceDoc } from "@/components/TripReferenceDoc";
import { getReferenceDocSlugs } from "@/lib/reference-docs";
import { getReferenceDocContent } from "@/lib/reference-docs.server";

export const dynamicParams = false;

export function generateStaticParams() {
  return getReferenceDocSlugs().map((slug) => ({ slug }));
}

type PageParams = { slug: string };

export default async function TripReferencePage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const { slug } = await params;
  const doc = getReferenceDocContent(slug);
  if (!doc) notFound();

  return (
    <TripReferenceDoc
      slug={slug}
      title={doc.title}
      subtitle={doc.subtitle}
      content={doc.content}
      toc={doc.toc}
    />
  );
}
