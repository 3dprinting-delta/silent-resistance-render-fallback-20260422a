"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

function normalizeNextPath(nextPath: string) {
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  return nextPath;
}

export function LoginForm({
  nextPath = "/",
  onSuccess,
  submitLabel = "Sign in",
}: {
  nextPath?: string;
  onSuccess?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = normalizeNextPath(nextPath);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await signIn("credentials", {
      redirect: false,
      username,
      password,
      callbackUrl,
    });

    setPending(false);

    if (result?.error) {
      setError("Invalid username or password.");
      return;
    }

    onSuccess?.();
    router.replace(result?.url || callbackUrl);
    router.refresh();
  }

  return (
    <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="brief-title">Username</span>
        <input
          className="rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-base text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="brief-title">Password</span>
        <input
          className="rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-base text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {error ? <p className="text-sm text-[#f1a092]">{error}</p> : null}

      <button className="ui-button mt-2 w-fit cursor-pointer" type="submit" disabled={pending}>
        {pending ? "Signing in..." : submitLabel}
      </button>
    </form>
  );
}
