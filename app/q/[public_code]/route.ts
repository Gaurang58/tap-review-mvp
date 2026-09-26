import { createReviewRedirectResponse } from "@/lib/review-redirect";

type RouteContext = {
  params: Promise<{ public_code: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { public_code: publicCode } = await params;

  return createReviewRedirectResponse(publicCode, "qr");
}
