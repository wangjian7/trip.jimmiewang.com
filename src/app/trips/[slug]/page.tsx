import { notFound } from "next/navigation";
import { TripEditor } from "@/components/TripEditor";
import { getTripBySlug, getTripSlugs } from "@/lib/trips";

export const dynamicParams = false;

export function generateStaticParams() {
  return getTripSlugs().map((slug) => ({ slug }));
}

type PageParams = { slug: string };

export default async function TripPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const { slug } = await params;
  const trip = getTripBySlug(slug);
  if (!trip) notFound();
  return <TripEditor trip={trip} />;
}
