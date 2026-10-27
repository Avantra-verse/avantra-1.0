// The "Share my card" screen the ambassador email links to: /card/PRI7K4?name=Priya&school=DPS%20Rourkela.
// Shows the ambassador's card (drawn by /ambassador-card/[code]) with a one-tap Share and a Download.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CardShare } from "./CardShare";

type Props = { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function card({ params, searchParams }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();
  const query = await searchParams;
  const keep = new URLSearchParams();
  for (const k of ["name", "school"]) {
    const v = query[k];
    if (typeof v === "string" && v.trim()) keep.set(k, v);
  }
  return { code, src: `/ambassador-card/${code}.png${keep.size ? `?${keep}` : ""}` };
}

// Personal page: kept out of search results. Shared as a link, it previews with the card itself.
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { src } = await card(props);
  return { title: "Ambassador card", robots: { index: false }, openGraph: { images: [{ url: src, width: 1080, height: 1920 }] } };
}

export default async function CardPage(props: Props) {
  const { code, src } = await card(props);
  return <CardShare code={code} src={src} />;
}
