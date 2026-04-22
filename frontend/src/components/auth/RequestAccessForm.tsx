"use client";

import { useEffect, useState, type FormEvent } from "react";

function detectDeviceLabel() {
  if (typeof window === "undefined") {
    return "Unknown device";
  }

  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform || "Unknown platform";

  if (/iphone/i.test(userAgent)) {
    return "iPhone";
  }

  if (/ipad/i.test(userAgent)) {
    return "iPad";
  }

  if (/android/i.test(userAgent)) {
    return "Android device";
  }

  if (/macintosh|mac os x/i.test(userAgent)) {
    return "Mac";
  }

  if (/windows/i.test(userAgent)) {
    return "Windows PC";
  }

  if (/linux/i.test(userAgent)) {
    return "Linux device";
  }

  return platform;
}

export function RequestAccessForm() {
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [deviceLabel, setDeviceLabel] = useState("Detecting device...");
  const [requestPrompt, setRequestPrompt] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDeviceLabel(detectDeviceLabel());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterName,
          requesterEmail,
          clientDeviceLabel: deviceLabel,
          requestPrompt,
        }),
      });

      const payload = (await response.json()) as { error?: string; warning?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit access request.");
      }

      setMessage(payload.warning || "Request submitted. Approval details will be sent to 375351feng@gmail.com.");
      setRequesterName("");
      setRequesterEmail("");
      setDeviceLabel(detectDeviceLabel());
      setRequestPrompt("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit access request.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="brief-title">Name</span>
        <input
          className="rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-base text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
          type="text"
          value={requesterName}
          onChange={(event) => setRequesterName(event.target.value)}
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="brief-title">Email</span>
        <input
          className="rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-base text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
          type="email"
          value={requesterEmail}
          onChange={(event) => setRequesterEmail(event.target.value)}
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="brief-title">Detected Device</span>
        <input
          className="rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-base text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
          type="text"
          value={deviceLabel}
          readOnly
        />
      </label>

      <label className="grid gap-2">
        <span className="brief-title">Request Prompt</span>
        <textarea
          className="min-h-[140px] rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-base text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
          value={requestPrompt}
          onChange={(event) => setRequestPrompt(event.target.value)}
          required
        />
      </label>

      {error ? <p className="text-sm text-[#f1a092]">{error}</p> : null}
      {message ? <p className="text-sm text-[#a7d0b8]">{message}</p> : null}

      <button className="ui-button mt-2 w-fit cursor-pointer" type="submit" disabled={pending}>
        {pending ? "Submitting..." : "Request 5-minute access"}
      </button>
    </form>
  );
}
