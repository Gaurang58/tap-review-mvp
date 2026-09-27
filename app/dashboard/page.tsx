import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { logout } from "./actions";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data,
    error
  } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : undefined;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <section className="mx-auto w-full max-w-4xl">
        <div className="flex flex-col gap-6 border-b border-slate-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-cyan-300">
              Tap Review MVP
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Dashboard</h1>
            {email ? (
              <p className="mt-2 text-sm text-slate-300">
                Signed in as {email}
              </p>
            ) : null}
          </div>

          <form action={logout}>
            <button
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-slate-900"
              type="submit"
            >
              Log out
            </button>
          </form>
        </div>

        <div className="py-10">
          <h2 className="text-xl font-semibold">Welcome</h2>
          <p className="mt-2 text-slate-300">Your dashboard session is active.</p>
        </div>
      </section>
    </main>
  );
}
