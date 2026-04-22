"use client";

import { useMemo, useState } from "react";
import type { AccessRequestListRecord } from "@/lib/access-requests";

type CredentialsState = Record<
  string,
  {
    username: string;
    password: string;
    warning?: string;
  }
>;

export function AccessRequestAdminPanel({
  requests,
}: {
  requests: AccessRequestListRecord[];
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [credentialsByRequest, setCredentialsByRequest] = useState<CredentialsState>({});

  const now = Date.now();
  const { pending, approved, expired } = useMemo(() => {
    return requests.reduce(
      (acc, request) => {
        const accessExpiresAt = request.credential?.accessExpiresAt ? new Date(request.credential.accessExpiresAt).getTime() : null;

        if (request.status === "PENDING") {
          acc.pending.push(request);
        } else if (accessExpiresAt && accessExpiresAt <= now) {
          acc.expired.push(request);
        } else {
          acc.approved.push(request);
        }

        return acc;
      },
      {
        pending: [] as AccessRequestListRecord[],
        approved: [] as AccessRequestListRecord[],
        expired: [] as AccessRequestListRecord[],
      },
    );
  }, [now, requests]);

  async function approveRequest(requestId: string) {
    setPendingId(requestId);
    setMessage(null);

    try {
      const response = await fetch(`/api/access-requests/${requestId}/approve`, {
        method: "POST",
      });

      const payload = (await response.json()) as {
        error?: string;
        warning?: string;
        username?: string;
        password?: string;
      };

      if (!response.ok || !payload.username || !payload.password) {
        throw new Error(payload.error || "Unable to approve request.");
      }

      setCredentialsByRequest((current) => ({
        ...current,
        [requestId]: {
          username: payload.username!,
          password: payload.password!,
          warning: payload.warning,
        },
      }));
      setMessage("Request approved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve request.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="portal-request-grid">
      {message ? <p className="portal-message">{message}</p> : null}

      <section className="portal-request-section">
        <h2>Pending</h2>
        {pending.length ? (
          pending.map((request) => (
            <article key={request.id} className="portal-request-card">
              <div className="portal-request-card__meta">
                <strong>{request.requesterName}</strong>
                <span>{request.requesterEmail}</span>
                <span>{request.deviceLabel}</span>
                <span>{request.claimedIpAddress}</span>
              </div>
              <p>{request.requestPrompt}</p>
              <button className="portal-button" type="button" disabled={pendingId === request.id} onClick={() => approveRequest(request.id)}>
                {pendingId === request.id ? "Generating..." : "Approve and generate"}
              </button>
              {credentialsByRequest[request.id] ? (
                <div className="portal-request-credentials">
                  <p>One-time username: {credentialsByRequest[request.id].username}</p>
                  <p>One-time password: {credentialsByRequest[request.id].password}</p>
                  {credentialsByRequest[request.id].warning ? <p>{credentialsByRequest[request.id].warning}</p> : null}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="portal-empty-card">No pending requests.</div>
        )}
      </section>

      <section className="portal-request-section">
        <h2>Approved</h2>
        {approved.length ? (
          approved.map((request) => (
            <article key={request.id} className="portal-request-card">
              <div className="portal-request-card__meta">
                <strong>{request.requesterName}</strong>
                <span>{request.requesterEmail}</span>
                <span>{request.deviceLabel}</span>
                <span>{request.claimedIpAddress}</span>
              </div>
              <p>{request.requestPrompt}</p>
              <p>Issued username: {request.credential?.username || "Not generated yet"}</p>
              <p>Approved by: {request.approvedBy || "Unknown"}</p>
              <p>First-use expiry starts on login.</p>
            </article>
          ))
        ) : (
          <div className="portal-empty-card">No approved requests.</div>
        )}
      </section>

      <section className="portal-request-section">
        <h2>Expired</h2>
        {expired.length ? (
          expired.map((request) => (
            <article key={request.id} className="portal-request-card">
              <div className="portal-request-card__meta">
                <strong>{request.requesterName}</strong>
                <span>{request.requesterEmail}</span>
                <span>{request.deviceLabel}</span>
                <span>{request.claimedIpAddress}</span>
              </div>
              <p>{request.requestPrompt}</p>
              <p>Issued username: {request.credential?.username || "Unknown"}</p>
              <p>Expired at: {request.credential?.accessExpiresAt ? new Date(request.credential.accessExpiresAt).toLocaleString() : "Unknown"}</p>
            </article>
          ))
        ) : (
          <div className="portal-empty-card">No expired requests.</div>
        )}
      </section>
    </div>
  );
}
