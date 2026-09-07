export default function PageHeader({
  title,
  lead,
}: {
  title: string;
  lead?: string;
}) {
  return (
    <header className="pt-20 pb-16">
      <h1 className="font-display text-[clamp(2.75rem,8vw,6rem)] font-extrabold leading-[0.9] tracking-[-0.03em] text-starlight">
        {title}
      </h1>
      {lead && (
        <p className="mt-8 max-w-[58ch] text-lg leading-relaxed text-starlight/75">{lead}</p>
      )}
      <div className="seam mt-14" />
    </header>
  );
}
