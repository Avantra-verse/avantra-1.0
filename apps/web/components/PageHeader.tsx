import MaskedReveal from "@/components/MaskedReveal";

export default function PageHeader({
  title,
  lead,
}: {
  title: string;
  lead?: string;
}) {
  return (
    <header className="pt-20 pb-16">
      {/* Uncovered from behind an edge, matching the home page's headings. */}
      <MaskedReveal>
        <h1 className="t-title text-starlight">{title}</h1>
      </MaskedReveal>

      {lead && <p className="t-lead mt-8 max-w-[58ch] text-secondary">{lead}</p>}

      <div className="seam mt-14" />
    </header>
  );
}
