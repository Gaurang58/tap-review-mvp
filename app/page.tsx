export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Tap Review MVP
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Initial Next.js scaffold for NFC and QR Google review analytics.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          This starter keeps the product surface intentionally minimal while
          the app foundation is put in place.
        </p>
      </section>
    </main>
  );
}
