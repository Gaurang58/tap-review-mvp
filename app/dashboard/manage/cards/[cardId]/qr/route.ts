import QRCode from "qrcode";

import { getPublicQrTarget } from "@/lib/public-app-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ cardId: string }>;
};

type QrFormat = "png" | "svg";

const cardIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function privateResponse(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function notFoundResponse() {
  return privateResponse("Not found", 404);
}

function serverErrorResponse() {
  return privateResponse("Unable to generate QR code", 500);
}

function sanitizePublicCode(publicCode: string) {
  return (
    publicCode
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 64) || "card"
  );
}

function createResponseHeaders(
  format: QrFormat,
  publicCode: string,
  download: boolean
) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type":
      format === "svg" ? "image/svg+xml; charset=utf-8" : "image/png",
    "X-Content-Type-Options": "nosniff"
  });

  if (download) {
    const safeCode = sanitizePublicCode(publicCode);
    headers.set(
      "Content-Disposition",
      `attachment; filename="tap-review-${safeCode}-qr.${format}"`
    );
  }

  return headers;
}

export async function GET(request: Request, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return privateResponse("Unauthorized", 401);
  }

  const { cardId } = await params;

  if (!cardIdPattern.test(cardId)) {
    return notFoundResponse();
  }

  const requestUrl = new URL(request.url);
  const formatValue = requestUrl.searchParams.get("format") ?? "svg";

  if (formatValue !== "svg" && formatValue !== "png") {
    return privateResponse("Unsupported QR format", 400);
  }

  const format: QrFormat = formatValue;
  const download = requestUrl.searchParams.get("download") === "1";
  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("public_code")
    .eq("id", cardId)
    .maybeSingle();

  if (cardError) {
    console.error("Dashboard QR card lookup failed.");
    return serverErrorResponse();
  }

  if (!card || typeof card.public_code !== "string" || !card.public_code) {
    return notFoundResponse();
  }

  try {
    const target = getPublicQrTarget(card.public_code);
    const options = {
      color: {
        dark: "#000000",
        light: "#ffffff"
      },
      errorCorrectionLevel: "M" as const,
      margin: 4
    };
    const headers = createResponseHeaders(
      format,
      card.public_code,
      download
    );

    if (format === "svg") {
      const svg = await QRCode.toString(target, {
        ...options,
        type: "svg"
      });

      return new Response(svg, { headers });
    }

    const png = await QRCode.toBuffer(target, {
      ...options,
      type: "png",
      width: 1024
    });

    return new Response(new Uint8Array(png), { headers });
  } catch {
    console.error("Dashboard QR generation failed.");
    return serverErrorResponse();
  }
}
