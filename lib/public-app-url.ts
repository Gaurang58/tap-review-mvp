import "server-only";

const fallbackPublicAppUrl = "https://tap-review-mvp.vercel.app";

export function getPublicAppOrigin() {
  const configuredUrl = process.env.PUBLIC_APP_URL?.trim();
  const value = configuredUrl || fallbackPublicAppUrl;

  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      throw new Error("PUBLIC_APP_URL must use HTTPS.");
    }

    return url.origin;
  } catch {
    throw new Error("PUBLIC_APP_URL must be a valid HTTPS URL.");
  }
}

export function getPublicQrTarget(publicCode: string) {
  if (!publicCode) {
    throw new Error("A public card code is required.");
  }

  return new URL(
    `/q/${encodeURIComponent(publicCode)}`,
    `${getPublicAppOrigin()}/`
  ).toString();
}
