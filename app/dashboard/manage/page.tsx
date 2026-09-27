import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { logout } from "../actions";
import {
  createCard,
  createLocation,
  setCardActive,
  setLocationActive
} from "./actions";

const statusMessages: Record<string, string> = {
  "location-created": "Location created.",
  "card-created": "Card created.",
  "location-updated": "Location updated.",
  "card-updated": "Card updated.",
  error: "Unable to complete that action."
};

type CardRow = {
  id: string;
  location_id: string;
  label: string | null;
  public_code: string;
  is_active: boolean;
};

function ManagementShell({
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
            <h1 className="mt-3 text-3xl font-semibold">Locations &amp; Cards</h1>
            {email ? (
              <p className="mt-2 text-sm text-slate-300">
                Signed in as {email}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-slate-900"
              href="/dashboard"
            >
              Back to dashboard
            </Link>
            <form action={logout}>
              <button
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-slate-900"
                type="submit"
              >
                Log out
              </button>
            </form>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}

function ManagementMessage({ children }: { children: ReactNode }) {
  return <p className="py-12 text-slate-300">{children}</p>;
}

export default async function ManagePage({
  searchParams
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
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
    .select("business_id, role")
    .eq("user_id", userId)
    .limit(2);

  if (membershipError) {
    console.error("Management membership query failed.");
    return (
      <ManagementShell email={email}>
        <ManagementMessage>Unable to load management data.</ManagementMessage>
      </ManagementShell>
    );
  }

  if (!memberships || memberships.length === 0) {
    return (
      <ManagementShell email={email}>
        <ManagementMessage>
          No business is linked to this account.
        </ManagementMessage>
      </ManagementShell>
    );
  }

  if (memberships.length !== 1) {
    return (
      <ManagementShell email={email}>
        <ManagementMessage>
          This page requires exactly one linked business.
        </ManagementMessage>
      </ManagementShell>
    );
  }

  const membership = memberships[0];
  const canManage =
    membership.role === "owner" || membership.role === "admin";
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", membership.business_id)
    .maybeSingle();

  if (businessError) {
    console.error("Management business query failed.");
    return (
      <ManagementShell email={email}>
        <ManagementMessage>Unable to load management data.</ManagementMessage>
      </ManagementShell>
    );
  }

  if (!business) {
    return (
      <ManagementShell email={email}>
        <ManagementMessage>
          No business is linked to this account.
        </ManagementMessage>
      </ManagementShell>
    );
  }

  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("id, name, google_place_id, is_active")
    .eq("business_id", business.id)
    .order("name");

  if (locationsError) {
    console.error("Management locations query failed.");
    return (
      <ManagementShell email={email}>
        <ManagementMessage>Unable to load management data.</ManagementMessage>
      </ManagementShell>
    );
  }

  const locationRows = locations ?? [];
  const locationIds = locationRows.map((location) => location.id);
  const cardsResult =
    locationIds.length === 0
      ? { data: [] as CardRow[], error: null }
      : await supabase
          .from("cards")
          .select("id, location_id, label, public_code, is_active")
          .in("location_id", locationIds)
          .order("label");

  if (cardsResult.error) {
    console.error("Management cards query failed.");
    return (
      <ManagementShell email={email}>
        <ManagementMessage>Unable to load management data.</ManagementMessage>
      </ManagementShell>
    );
  }

  const cards: CardRow[] = cardsResult.data ?? [];
  const cardsByLocation = new Map<string, CardRow[]>();

  locationRows.forEach((location) => {
    cardsByLocation.set(location.id, []);
  });

  cards.forEach((card) => {
    cardsByLocation.get(card.location_id)?.push(card);
  });

  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const feedback = statusMessages[status];

  return (
    <ManagementShell email={email}>
      <section className="py-10">
        <p className="text-sm text-slate-400">Business</p>
        <h2 className="mt-1 text-2xl font-semibold">{business.name}</h2>
        {!canManage ? (
          <p className="mt-3 text-sm text-slate-400">
            Viewer access is read-only.
          </p>
        ) : null}

        {feedback ? (
          <p
            className={
              status === "error"
                ? "mt-6 border-l-2 border-red-400 px-4 py-2 text-sm text-red-200"
                : "mt-6 border-l-2 border-emerald-400 px-4 py-2 text-sm text-emerald-200"
            }
            role="status"
          >
            {feedback}
          </p>
        ) : null}
      </section>

      {canManage ? (
        <section className="grid gap-6 border-t border-slate-800 py-10 lg:grid-cols-2">
          <form
            action={createLocation}
            className="rounded-md border border-slate-800 bg-slate-900 p-6"
          >
            <h2 className="text-lg font-semibold">Create location</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium" htmlFor="name">
                Location name
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
                id="name"
                name="name"
                required
                type="text"
              />

              <label
                className="block text-sm font-medium"
                htmlFor="google_place_id"
              >
                Google Place ID
              </label>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
                id="google_place_id"
                name="google_place_id"
                required
                type="text"
              />
            </div>
            <button
              className="mt-6 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
              type="submit"
            >
              Create location
            </button>
          </form>

          {locationRows.length > 0 ? (
            <form
              action={createCard}
              className="rounded-md border border-slate-800 bg-slate-900 p-6"
            >
              <h2 className="text-lg font-semibold">Create card</h2>
              <div className="mt-5 space-y-4">
                <label
                  className="block text-sm font-medium"
                  htmlFor="location_id"
                >
                  Location
                </label>
                <select
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  id="location_id"
                  name="location_id"
                  required
                >
                  {locationRows.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>

                <label className="block text-sm font-medium" htmlFor="label">
                  Card label
                </label>
                <input
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
                  id="label"
                  name="label"
                  required
                  type="text"
                />
              </div>
              <button
                className="mt-6 rounded-md bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-200"
                type="submit"
              >
                Create card
              </button>
            </form>
          ) : (
            <div className="self-center text-slate-400">
              Create a location before adding a card.
            </div>
          )}
        </section>
      ) : null}

      <section className="border-t border-slate-800 py-10">
        <h2 className="text-xl font-semibold">Locations &amp; Cards</h2>

        {locationRows.length === 0 ? (
          <p className="mt-4 text-slate-400">No locations yet.</p>
        ) : (
          <div className="mt-8 divide-y divide-slate-800 border-y border-slate-800">
            {locationRows.map((location) => {
              const locationCards = cardsByLocation.get(location.id) ?? [];

              return (
                <section className="py-8" key={location.id}>
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold">
                          {location.name}
                        </h3>
                        <span
                          className={
                            location.is_active
                              ? "text-sm text-emerald-300"
                              : "text-sm text-amber-300"
                          }
                        >
                          {location.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        Google Place ID:{" "}
                        <code className="text-slate-300">
                          {location.google_place_id || "Not set"}
                        </code>
                      </p>
                      {!location.is_active ? (
                        <p className="mt-2 text-sm text-amber-200">
                          Review redirects are unavailable while this location
                          is inactive.
                        </p>
                      ) : null}
                    </div>

                    {canManage ? (
                      <form action={setLocationActive}>
                        <input
                          name="location_id"
                          type="hidden"
                          value={location.id}
                        />
                        <input
                          name="is_active"
                          type="hidden"
                          value={location.is_active ? "false" : "true"}
                        />
                        <button
                          className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-slate-900"
                          type="submit"
                        >
                          {location.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {locationCards.length === 0 ? (
                    <p className="mt-6 text-sm text-slate-400">
                      No cards for this location.
                    </p>
                  ) : (
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="border-b border-slate-700 text-slate-400">
                          <tr>
                            <th className="pb-3 pr-6 font-medium">Card</th>
                            <th className="pb-3 pr-6 font-medium">Status</th>
                            <th className="pb-3 pr-6 font-medium">Paths</th>
                            {canManage ? (
                              <th className="pb-3 text-right font-medium">
                                Action
                              </th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {locationCards.map((card) => (
                            <tr key={card.id}>
                              <td className="py-4 pr-6 align-top">
                                <p className="font-medium">
                                  {card.label || "Unlabelled card"}
                                </p>
                                <code className="mt-1 block text-xs text-slate-400">
                                  {card.public_code}
                                </code>
                              </td>
                              <td
                                className={
                                  card.is_active
                                    ? "py-4 pr-6 align-top text-emerald-300"
                                    : "py-4 pr-6 align-top text-amber-300"
                                }
                              >
                                {card.is_active ? "Active" : "Inactive"}
                              </td>
                              <td className="py-4 pr-6 align-top text-slate-300">
                                <code className="block">
                                  /t/{card.public_code}
                                </code>
                                <code className="mt-1 block">
                                  /q/{card.public_code}
                                </code>
                              </td>
                              {canManage ? (
                                <td className="py-4 text-right align-top">
                                  <form action={setCardActive}>
                                    <input
                                      name="card_id"
                                      type="hidden"
                                      value={card.id}
                                    />
                                    <input
                                      name="is_active"
                                      type="hidden"
                                      value={
                                        card.is_active ? "false" : "true"
                                      }
                                    />
                                    <button
                                      className="rounded-md border border-slate-700 px-3 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-slate-900"
                                      type="submit"
                                    >
                                      {card.is_active
                                        ? "Deactivate"
                                        : "Activate"}
                                    </button>
                                  </form>
                                </td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </ManagementShell>
  );
}
