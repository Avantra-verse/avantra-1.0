import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col items-start justify-center px-6 py-24">
      <p className="t-small text-muted">404</p>
      <h1 className="t-title mt-3 text-starlight">This universe doesn&apos;t exist.</h1>
      <p className="t-lead mt-6 max-w-[44ch] text-secondary">
        The page may have moved, or it isn&apos;t open yet. Head back and pick another door.
      </p>
      <Link
        href="/"
        className="mt-10 inline-flex min-h-11 items-center rounded-full border border-white/20 px-6 font-semibold text-starlight transition-colors hover:border-white/50"
      >
        Back to AVANTRA
      </Link>
    </div>
  );
}
