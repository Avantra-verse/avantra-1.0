export default function PageHeader({
  title,
  lead,
}: {
  title: string;
  lead?: string;
}) {
  return (
    <header className="pt-20 pb-16">
      <h1 className="t-title text-starlight">
        {title}
      </h1>
      {lead && (
        <p className="t-lead mt-8 max-w-[58ch] text-secondary">{lead}</p>
      )}
      <div className="seam mt-14" />
    </header>
  );
}
