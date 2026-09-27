"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const managePath = "/dashboard/manage";

function getRequiredString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function redirectWithError(message: string): never {
  console.error(message);
  redirect(`${managePath}?status=error`);
}

function finishMutation(status: string): never {
  revalidatePath(managePath);
  revalidatePath("/dashboard");
  redirect(`${managePath}?status=${status}`);
}

async function resolveManagerContext() {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const userId = claimsData.claims.sub;

  if (typeof userId !== "string" || userId === "") {
    redirect("/login");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", userId)
    .limit(2);

  if (membershipError) {
    redirectWithError("Management membership query failed.");
  }

  if (!memberships || memberships.length !== 1) {
    redirect(`${managePath}?status=error`);
  }

  const membership = memberships[0];

  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect(`${managePath}?status=error`);
  }

  return {
    businessId: membership.business_id,
    supabase
  };
}

async function verifyLocation(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  businessId: string,
  locationId: string
) {
  const { data: location, error } = await supabase
    .from("locations")
    .select("id")
    .eq("id", locationId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    redirectWithError("Management location verification failed.");
  }

  if (!location) {
    redirect(`${managePath}?status=error`);
  }

  return location;
}

export async function createLocation(formData: FormData) {
  const name = getRequiredString(formData, "name");
  const googlePlaceId = getRequiredString(formData, "google_place_id");

  if (!name || !googlePlaceId) {
    redirect(`${managePath}?status=error`);
  }

  const { businessId, supabase } = await resolveManagerContext();
  const reviewUrl = new URL("https://search.google.com/local/writereview");
  reviewUrl.searchParams.set("placeid", googlePlaceId);

  const { error } = await supabase.from("locations").insert({
    business_id: businessId,
    name,
    google_place_id: googlePlaceId,
    google_review_url: reviewUrl.toString()
  });

  if (error) {
    redirectWithError("Location creation failed.");
  }

  finishMutation("location-created");
}

export async function createCard(formData: FormData) {
  const locationId = getRequiredString(formData, "location_id");
  const label = getRequiredString(formData, "label");

  if (!locationId || !label) {
    redirect(`${managePath}?status=error`);
  }

  const { businessId, supabase } = await resolveManagerContext();
  await verifyLocation(supabase, businessId, locationId);

  const publicCode = randomUUID().replaceAll("-", "");
  const { error } = await supabase.from("cards").insert({
    location_id: locationId,
    label,
    public_code: publicCode
  });

  if (error) {
    redirectWithError("Card creation failed.");
  }

  finishMutation("card-created");
}

export async function setLocationActive(formData: FormData) {
  const locationId = getRequiredString(formData, "location_id");
  const activeValue = getRequiredString(formData, "is_active");

  if (!locationId || (activeValue !== "true" && activeValue !== "false")) {
    redirect(`${managePath}?status=error`);
  }

  const { businessId, supabase } = await resolveManagerContext();
  await verifyLocation(supabase, businessId, locationId);

  const { data: updatedLocation, error } = await supabase
    .from("locations")
    .update({ is_active: activeValue === "true" })
    .eq("id", locationId)
    .eq("business_id", businessId)
    .select("id")
    .maybeSingle();

  if (error || !updatedLocation) {
    redirectWithError("Location status update failed.");
  }

  finishMutation("location-updated");
}

export async function setCardActive(formData: FormData) {
  const cardId = getRequiredString(formData, "card_id");
  const activeValue = getRequiredString(formData, "is_active");

  if (!cardId || (activeValue !== "true" && activeValue !== "false")) {
    redirect(`${managePath}?status=error`);
  }

  const { businessId, supabase } = await resolveManagerContext();
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("id, location_id")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    redirectWithError("Management card verification failed.");
  }

  if (!card) {
    redirect(`${managePath}?status=error`);
  }

  await verifyLocation(supabase, businessId, card.location_id);

  const { data: updatedCard, error } = await supabase
    .from("cards")
    .update({ is_active: activeValue === "true" })
    .eq("id", card.id)
    .select("id")
    .maybeSingle();

  if (error || !updatedCard) {
    redirectWithError("Card status update failed.");
  }

  finishMutation("card-updated");
}
