"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PortalEntryRecord } from "@/lib/portal-data";

export function EntryList({ entries }: { entries: PortalEntryRecord[] }) {
  const router = useRouter();
  const [draftStatus, setDraftStatus] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!entries.length) {
    return <div className="portal-empty-card">No entries recorded for this category yet.</div>;
  }

  async function saveStatus(entryId: string) {
    const nextStatus = (draftStatus[entryId] ?? "").trim();
    if (!nextStatus) {
      setMessage("Status cannot be empty.");
      return;
    }

    setSavingId(entryId);
    setMessage(null);

    try {
      const response = await fetch("/api/portal/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
          status: nextStatus,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to update status.");
      }

      setMessage("Status updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update status.");
    } finally {
      setSavingId(null);
    }
  }

  async function removeEntry(entryId: string) {
    const confirmed = window.confirm("Delete this entry?");
    if (!confirmed) {
      return;
    }

    setDeletingId(entryId);
    setMessage(null);

    try {
      const response = await fetch("/api/portal/entries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete entry.");
      }

      setMessage("Entry deleted.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete entry.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="portal-entry-stack">
      {message ? <p className="portal-message">{message}</p> : null}
      {entries.map((entry) => (
        <article key={entry.id} className="portal-entry-card">
          <div className="portal-entry-icon">#</div>
          <div className="portal-entry-body">
            <div className="portal-entry-header">
              <h3>{entry.title}</h3>
              <span className="portal-status-pill">{entry.status}</span>
            </div>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[#a79b8d]">
              Uploader identity: {entry.createdBy || "Unknown"}
            </p>
            <Link href={entry.url} target="_blank" rel="noreferrer" className="portal-entry-link">
              {entry.url}
            </Link>
            {entry.description ? <p className="mt-3 text-sm leading-7 text-[#cdbfb2]">{entry.description}</p> : null}
            {entry.editable ? (
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  className="rounded-[14px] border border-white/10 bg-black/30 px-3 py-2 text-sm text-[#f2ebe2] outline-none transition focus:border-[#d55555]"
                  list="portal-status-edit-options"
                  value={draftStatus[entry.id] ?? entry.status}
                  onChange={(event) =>
                    setDraftStatus((current) => ({
                      ...current,
                      [entry.id]: event.target.value,
                    }))
                  }
                  placeholder="Update status"
                  disabled={savingId === entry.id}
                />
                <button
                  className="portal-button"
                  type="button"
                  onClick={() => saveStatus(entry.id)}
                  disabled={savingId === entry.id || deletingId === entry.id}
                >
                  {savingId === entry.id ? "Saving..." : "Update status"}
                </button>
                <button
                  className="portal-button portal-button-danger"
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  disabled={savingId === entry.id || deletingId === entry.id}
                >
                  {deletingId === entry.id ? "Deleting..." : "Delete entry"}
                </button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
      <datalist id="portal-status-edit-options">
        <option value="ongoing" />
        <option value="broken" />
        <option value="blocked" />
        <option value="restricted" />
        <option value="sealed" />
        <option value="archived" />
      </datalist>
    </div>
  );
}
