import Reveal from "@/components/Reveal";

export default function PageHeader({
  title,
  lead,
}: {
  title: string;
  lead?: string;
}) {
  return (
    <Reveal>
      <header className="pt-20 pb-12">
        <h1 className="font-display text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-starlight">
          {title}
        </h1>
        {lead && (
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-starlight/70">{lead}</p>
        )}
        <div className="rift-rule mt-10" />
      </header>
    </Reveal>
  );
}
