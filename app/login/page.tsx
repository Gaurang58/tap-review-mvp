import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <section className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase text-cyan-300">
          Tap Review MVP
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Dashboard login</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Sign in with your dashboard account.
        </p>

        {error ? (
          <p
            className="mt-5 rounded-md border border-red-800 bg-red-950 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            Unable to sign in. Check your email and password.
          </p>
        ) : null}

        <form action={login} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="password">
              Password
            </label>
            <input
              autoComplete="current-password"
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
              id="password"
              name="password"
              required
              type="password"
            />
          </div>

          <button
            className="w-full rounded-md bg-cyan-300 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-200"
            type="submit"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
