import "server-only";

import { createPrivilegedSupabaseClient } from "@/lib/supabase/admin";

type ReviewMethod = "nfc" | "qr";

function notFoundResponse() {
  return new Response("Not found", { status: 404 });
}

function serverErrorResponse() {
  return new Response("Internal Server Error", { status: 500 });
}

function parseReviewUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export async function createReviewRedirectResponse(
  publicCode: string,
  method: ReviewMethod
) {
  const logPrefix = method.toUpperCase();

  try {
    const supabase = createPrivilegedSupabaseClient();
    const database = supabase.schema("public");

    const { data: card, error: cardError } = await database
      .from("cards")
      .select("id, location_id, is_active")
      .eq("public_code", publicCode)
      .maybeSingle();

    if (cardError) {
      console.error(`${logPrefix} card lookup failed.`);
      return serverErrorResponse();
    }

    if (!card || !card.is_active || !card.location_id) {
      return notFoundResponse();
    }

    const { data: location, error: locationError } = await database
      .from("locations")
      .select("google_review_url, is_active")
      .eq("id", card.location_id)
      .maybeSingle();

    if (locationError) {
      console.error(`${logPrefix} location lookup failed.`);
      return serverErrorResponse();
    }

    const reviewUrl = parseReviewUrl(location?.google_review_url);

    if (!location || !location.is_active || !reviewUrl) {
      return notFoundResponse();
    }

    try {
      const { error: interactionError } = await database
        .from("interactions")
        .insert({ card_id: card.id, method });

      if (interactionError) {
        console.error(`${logPrefix} interaction logging failed.`);
      }
    } catch {
      console.error(`${logPrefix} interaction logging failed.`);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: reviewUrl.toString(),
        "Cache-Control": "no-store"
      }
    });
  } catch {
    console.error(`${logPrefix} redirect request failed.`);
    return serverErrorResponse();
  }
}
