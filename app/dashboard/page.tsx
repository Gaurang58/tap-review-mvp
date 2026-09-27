import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { logout } from "./actions";

const activityDateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short"
});

function DashboardShell({
  children,
  email
}: {
  children: ReactNode;
  email?: string;
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white sm:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex flex-col gap-6 border-b border-slate-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
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
        </header>

        {children}
      </div>
    </main>
  );
}

function DashboardMessage({ children }: { children: ReactNode }) {
  return <p className="py-12 text-slate-300">{children}</p>;
}

function formatOccurredAt(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : activityDateFormatter.format(date);
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const userId = claimsData.claims.sub;
  const email =
    typeof claimsData.claims.email === "string"
      ? claimsData.claims.email
      : undefined;

  if (typeof userId !== "string" || userId === "") {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId)
    .limit(2);

  if (membershipError) {
    console.error("Dashboard membership query failed.");
    return (
      <DashboardShell email={email}>
        <DashboardMessage>Unable to load dashboard data.</DashboardMessage>
      </DashboardShell>
    );
  }

  if (!memberships || memberships.length === 0) {
    return (
      <DashboardShell email={email}>
        <DashboardMessage>
          No business is linked to this account.
        </DashboardMessage>
      </DashboardShell>
    );
  }

  if (memberships.length !== 1) {
    return (
      <DashboardShell email={email}>
        <DashboardMessage>
          This dashboard requires exactly one linked business.
        </DashboardMessage>
      </DashboardShell>
    );
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", memberships[0].business_id)
    .maybeSingle();

  if (businessError) {
    console.error("Dashboard business query failed.");
    return (
      <DashboardShell email={email}>
        <DashboardMessage>Unable to load dashboard data.</DashboardMessage>
      </DashboardShell>
    );
  }

  if (!business) {
    return (
      <DashboardShell email={email}>
        <DashboardMessage>
          No business is linked to this account.
        </DashboardMessage>
      </DashboardShell>
    );
  }

  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("id, name")
    .eq("business_id", business.id);

  if (locationsError) {
    console.error("Dashboard locations query failed.");
    return (
      <DashboardShell email={email}>
        <DashboardMessage>Unable to load dashboard data.</DashboardMessage>
      </DashboardShell>
    );
  }

  const locationIds = (locations ?? []).map((location) => location.id);
  const locationNames = new Map(
    (locations ?? []).map((location) => [location.id, location.name])
  );

  const cardsResult =
    locationIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("cards")
          .select("id, label, location_id")
          .in("location_id", locationIds);

  if (cardsResult.error) {
    console.error("Dashboard cards query failed.");
    return (
      <DashboardShell email={email}>
        <DashboardMessage>Unable to load dashboard data.</DashboardMessage>
      </DashboardShell>
    );
  }

  const cards = cardsResult.data ?? [];
  const cardIds = cards.map((card) => card.id);
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  const emptyAnalytics = {
    total: 0,
    nfc: 0,
    qr: 0,
    recent: [] as Array<{
      id: string;
      card_id: string;
      method: string;
      occurred_at: string;
    }>
  };

  let analytics = emptyAnalytics;

  if (cardIds.length > 0) {
    const [totalResult, nfcResult, qrResult, recentResult] = await Promise.all([
      supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .in("card_id", cardIds),
      supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .in("card_id", cardIds)
        .eq("method", "nfc"),
      supabase
        .from("interactions")
        .select("id", { count: "exact", head: true })
        .in("card_id", cardIds)
        .eq("method", "qr"),
      supabase
        .from("interactions")
        .select("id, card_id, method, occurred_at")
        .in("card_id", cardIds)
        .order("occurred_at", { ascending: false })
        .limit(10)
    ]);

    if (
      totalResult.error ||
      nfcResult.error ||
      qrResult.error ||
      recentResult.error
    ) {
      console.error("Dashboard interactions query failed.");
      return (
        <DashboardShell email={email}>
          <DashboardMessage>Unable to load dashboard data.</DashboardMessage>
        </DashboardShell>
      );
    }

    analytics = {
      total: totalResult.count ?? 0,
      nfc: nfcResult.count ?? 0,
      qr: qrResult.count ?? 0,
      recent: recentResult.data ?? []
    };
  }

  const summary = [
    { label: "Total interactions", value: analytics.total },
    { label: "NFC taps", value: analytics.nfc },
    { label: "QR scans", value: analytics.qr }
  ];

  return (
    <DashboardShell email={email}>
      <section className="py-10">
        <p className="text-sm text-slate-400">Business</p>
        <h2 className="mt-1 text-2xl font-semibold">{business.name}</h2>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {summary.map((item) => (
            <div
              className="rounded-md border border-slate-800 bg-slate-900 p-5"
              key={item.label}
            >
              <p className="text-sm text-slate-400">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {item.value.toLocaleString("en-GB")}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-800 py-10">
        <h2 className="text-xl font-semibold">Recent activity</h2>

        {analytics.recent.length === 0 ? (
          <p className="mt-4 text-slate-400">No interactions yet.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="pb-3 pr-6 font-medium">Method</th>
                  <th className="pb-3 pr-6 font-medium">Card</th>
                  <th className="pb-3 pr-6 font-medium">Location</th>
                  <th className="pb-3 font-medium">Occurred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {analytics.recent.map((interaction) => {
                  const card = cardsById.get(interaction.card_id);

                  return (
                    <tr key={interaction.id}>
                      <td className="py-4 pr-6 font-medium">
                        {interaction.method === "nfc" ? "NFC" : "QR"}
                      </td>
                      <td className="py-4 pr-6 text-slate-300">
                        {card?.label || "Unlabelled card"}
                      </td>
                      <td className="py-4 pr-6 text-slate-300">
                        {card
                          ? locationNames.get(card.location_id) ||
                            "Unknown location"
                          : "Unknown location"}
                      </td>
                      <td className="py-4 text-slate-300">
                        {formatOccurredAt(interaction.occurred_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
