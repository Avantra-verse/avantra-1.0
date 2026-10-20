import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center px-6 py-24">
      {/* Ember card (DESIGN.md), same as the Venue page */}
      <div className="max-w-2xl rounded-[26px] border-[3px] border-sky bg-panel p-7 shadow-[0_0_0_6px_var(--color-ember),0_24px_60px_rgb(0_0_0/0.45)] sm:p-10">
        <p className="t-small text-muted">404</p>
        <h1 className="t-title mt-3 text-starlight">This universe doesn&apos;t exist.</h1>
        <p className="t-lead mt-6 max-w-[44ch] text-secondary">
          The page may have moved, or it isn&apos;t open yet. Head back and pick another door.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center rounded-full border-[3px] border-sky bg-ember px-7 font-[family-name:var(--font-display)] text-lg text-white transition-[background-color,box-shadow] duration-200 hover:bg-ember-hot hover:shadow-[0_6px_24px_rgb(159_212_255/0.35)]"
        >
          Back to AVANTRA
        </Link>
      </div>
    </div>
  );
}
