import { createPrivilegedSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ public_code: string }>;
};

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

export async function GET(_request: Request, { params }: RouteContext) {
  const { public_code: publicCode } = await params;

  try {
    const supabase = createPrivilegedSupabaseClient();
    const database = supabase.schema("public");

    const { data: card, error: cardError } = await database
      .from("cards")
      .select("id, location_id, is_active")
      .eq("public_code", publicCode)
      .maybeSingle();

    if (cardError) {
      console.error("NFC card lookup failed.");
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
      console.error("NFC location lookup failed.");
      return serverErrorResponse();
    }

    const reviewUrl = parseReviewUrl(location?.google_review_url);

    if (!location || !location.is_active || !reviewUrl) {
      return notFoundResponse();
    }

    try {
      const { error: interactionError } = await database
        .from("interactions")
        .insert({ card_id: card.id, method: "nfc" });

      if (interactionError) {
        console.error("NFC interaction logging failed.");
      }
    } catch {
      console.error("NFC interaction logging failed.");
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: reviewUrl.toString(),
        "Cache-Control": "no-store"
      }
    });
  } catch {
    console.error("NFC redirect request failed.");
    return serverErrorResponse();
  }
}
