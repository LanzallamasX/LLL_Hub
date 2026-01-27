import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-xl rounded-2xl border border-lll-border bg-lll-bg-soft p-6">
        <h1 className="text-2xl font-semibold">LLL Hub</h1>
        <p className="mt-2 text-sm text-lll-text-soft">
          Prototipo MVP en Next.js + Tailwind. Tema LLL activo.
        </p>

        <div className="mt-5 flex gap-2">
          <Link
            href="/login"
            className="px-4 py-2 rounded-lg bg-lll-accent text-black font-semibold"
          >
            Ir a Login
          </Link>

          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-lll-border bg-lll-bg-softer text-lll-text"
          >
            Ir a Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
