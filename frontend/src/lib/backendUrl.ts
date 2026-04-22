const LOCAL_BACKEND_FALLBACK = "http://localhost:4001";

function firstNonEmpty(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

export function getPublicBackendBaseUrl() {
  const configured = firstNonEmpty(
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.NEXT_PUBLIC_MULTIPLAYER_URL,
    process.env.NEXT_PUBLIC_WORLD_AUTHORITY_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  );

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Public backend base URL is not configured for production.");
  }

  return LOCAL_BACKEND_FALLBACK;
}

export function getServerBackendBaseUrl() {
  const configured = firstNonEmpty(
    process.env.BACKEND_INTERNAL_URL,
    process.env.MULTIPLAYER_INTERNAL_URL,
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.NEXT_PUBLIC_MULTIPLAYER_URL,
    process.env.NEXT_PUBLIC_WORLD_AUTHORITY_URL,
    process.env.NEXT_PUBLIC_API_BASE_URL,
  );

  if (configured) {
    return configured.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Server backend base URL is not configured for production.");
  }

  return LOCAL_BACKEND_FALLBACK;
}

export function getShareSiteBaseUrl() {
  return firstNonEmpty(process.env.NEXT_PUBLIC_SHARE_SITE_URL, getPublicBackendBaseUrl()).replace(/\/$/, "");
}
