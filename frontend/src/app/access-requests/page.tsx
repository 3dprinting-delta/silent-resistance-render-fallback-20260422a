import { AccessRequestAdminPanel } from "@/components/portal/AccessRequestAdminPanel";
import { PortalNav } from "@/components/portal/PortalNav";
import { listAccessRequests } from "@/lib/access-requests";
import { isCorePortalUsername } from "@/lib/auth";
import { requirePortalSession } from "@/lib/require-portal-session";

export default async function AccessRequestsPage() {
  const session = await requirePortalSession("/access-requests");
  if (!isCorePortalUsername(session.user?.username)) {
    return (
      <main className="portal-shell portal-shell-detail portal-shell-detail-light">
        <PortalNav active="access-requests" />
        <section className="portal-empty-card" style={{ marginTop: "24px" }}>
          Unauthorized.
        </section>
      </main>
    );
  }

  const requests = await listAccessRequests();

  return (
    <main className="portal-shell portal-shell-detail portal-shell-detail-light">
      <PortalNav active="access-requests" />
      <section className="portal-section-heading portal-section-heading-light">
        <div>
          <p className="eyebrow">Access Requests</p>
          <h1>5-minute access approvals</h1>
          <p>Review submitted access requests, generate one-time usernames and passwords, and monitor active or expired temporary access.</p>
        </div>
      </section>

      <section className="portal-detail-grid" style={{ marginTop: "24px" }}>
        <AccessRequestAdminPanel requests={requests} />
      </section>
    </main>
  );
}
