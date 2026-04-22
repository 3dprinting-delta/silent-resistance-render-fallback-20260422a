const COOKIE_NAME = "silent-resistance-state";

export function readEliminatedTargets(cookieStore) {
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.eliminatedTargets)) {
      return [];
    }
    return parsed.eliminatedTargets.filter((value) => typeof value === "string");
  } catch (_error) {
    return [];
  }
}

export function writeEliminatedTargets(response, eliminatedTargets) {
  response.cookies.set(COOKIE_NAME, JSON.stringify({ eliminatedTargets }), {
    httpOnly: false,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
