"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { PortalSectionSlug } from "@/lib/portal-config";

type CategoryOption = {
  slug: string;
  label: string;
};

export function EntryUploadForm({
  section,
  categories,
  defaultCategory,
  enabled,
}: {
  section: PortalSectionSlug;
  categories: CategoryOption[];
  defaultCategory?: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const initialCategory = useMemo(
    () => defaultCategory || categories[0]?.slug || "",
    [categories, defaultCategory],
  );
  const [category, setCategory] = useState(initialCategory);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("ongoing");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;

    setPending(true);
    setMessage(null);

    try {
      const response = await fetch("/api/portal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          category,
          title,
          url,
          status,
          description,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to save entry.");
      }

      setTitle("");
      setUrl("");
      setStatus("ongoing");
      setDescription("");
      setMessage("Entry saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save entry.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="portal-upload-card" onSubmit={handleSubmit}>
      <div className="portal-upload-header">
        <p className="eyebrow">Upload</p>
        <h3>Organize a new entry</h3>
      </div>

      <label className="portal-field">
        <span>Classification</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)} disabled={!enabled || pending}>
          {categories.map((option) => (
            <option key={option.slug} value={option.slug}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="portal-field">
        <span>Name</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Subsystem title" required disabled={!enabled || pending} />
      </label>

      <label className="portal-field">
        <span>URL</span>
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" required disabled={!enabled || pending} />
      </label>

      <label className="portal-field">
        <span>Current status</span>
        <input list="portal-status-options" value={status} onChange={(event) => setStatus(event.target.value)} placeholder="ongoing" required disabled={!enabled || pending} />
      </label>

      <label className="portal-field">
        <span>Description (optional)</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add context, notes, or instructions"
          rows={4}
          disabled={!enabled || pending}
          className="rounded-[18px] border border-white/10 bg-black/30 px-4 py-3 text-base text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
        />
      </label>
      <datalist id="portal-status-options">
        <option value="ongoing" />
        <option value="broken" />
        <option value="blocked" />
        <option value="restricted" />
        <option value="sealed" />
        <option value="archived" />
      </datalist>

      {!enabled ? <p className="portal-message portal-message-warning">Database persistence is not configured in this environment yet.</p> : null}
      {message ? <p className="portal-message">{message}</p> : null}

      <button className="portal-button" type="submit" disabled={!enabled || pending}>
        {pending ? "Saving..." : "Save entry"}
      </button>
    </form>
  );
}
