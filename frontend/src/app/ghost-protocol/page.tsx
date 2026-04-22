import Link from "next/link";
import { PortalNav } from "@/components/portal/PortalNav";
import { AgentPortrait } from "@/components/portal/AgentPortrait";
import { EntryUploadForm } from "@/components/portal/EntryUploadForm";
import { ghostProtocolAgents, portalGmailAddresses } from "@/lib/portal-config";
import { getPortalCounts, portalPersistenceEnabled } from "@/lib/portal-data";
import { requirePortalSession } from "@/lib/require-portal-session";

export default async function GhostProtocolPage() {
  await requirePortalSession("/ghost-protocol");
  const counts = await getPortalCounts("ghost-protocol");

  return (
    <main className="portal-shell portal-shell-ghost">
      <PortalNav active="ghost-protocol" />

      <section className="portal-section-heading portal-section-heading-dark">
        <div>
          <p className="eyebrow">Ghost Protocol</p>
          <h1>Unit 404: The Ghost Protocol</h1>
          <p>
            On the surface, these are elite AICs assigned to Kappa-4. In practice, this section tracks the four operator
            identities, their linked subsystem URLs, and the current status labels for each route.
          </p>
          <div className="portal-email-block portal-email-block-dark">
            <p className="portal-email-title">Contact Gmail</p>
            <div className="portal-email-list">
              {portalGmailAddresses.map((address) => (
                <a key={address} href={`mailto:${address}`} className="portal-email-link portal-email-link-dark">
                  {address}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="portal-index-grid portal-index-grid-dark">
        <div className="portal-agent-grid">
          {ghostProtocolAgents.map((agent) => (
            <Link key={agent.slug} href={`/ghost-protocol/${agent.slug}`} className="portal-agent-card">
              <AgentPortrait label={agent.label} accent={agent.accent} role={agent.role} />
              <div className="portal-agent-card__copy">
                <h3>{agent.label}</h3>
                <p>{agent.summary}</p>
                <span className="portal-meta-pill portal-meta-pill-dark">{counts[agent.slug] || 0} entries</span>
              </div>
            </Link>
          ))}
        </div>

        <EntryUploadForm
          section="ghost-protocol"
          categories={ghostProtocolAgents.map((agent) => ({ slug: agent.slug, label: agent.label }))}
          enabled={portalPersistenceEnabled}
        />
      </section>
    </main>
  );
}
