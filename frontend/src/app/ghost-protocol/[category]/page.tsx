import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalNav } from "@/components/portal/PortalNav";
import { AgentPortrait } from "@/components/portal/AgentPortrait";
import { EntryList } from "@/components/portal/EntryList";
import { EntryUploadForm } from "@/components/portal/EntryUploadForm";
import { ghostProtocolAgents } from "@/lib/portal-config";
import { getGhostAgentBySlug, listPortalEntries, portalPersistenceEnabled } from "@/lib/portal-data";
import { requirePortalSession } from "@/lib/require-portal-session";

export default async function GhostProtocolDetailPage({ params }: { params: { category: string } }) {
  await requirePortalSession(`/ghost-protocol/${params.category}`);
  const agent = getGhostAgentBySlug(params.category);
  if (!agent) {
    notFound();
  }

  const entries = await listPortalEntries("ghost-protocol", agent.slug);

  return (
    <main className="portal-shell portal-shell-ghost portal-shell-detail">
      <PortalNav active="ghost-protocol" />

      <section className="portal-ghost-detail">
        <aside className="portal-ghost-sidebar">
          {ghostProtocolAgents.map((entry) => (
            <Link key={entry.slug} href={`/ghost-protocol/${entry.slug}`} className={`portal-ghost-sidebar-link ${entry.slug === agent.slug ? "is-active" : ""}`}>
              <AgentPortrait label={entry.label} accent={entry.accent} role={entry.role} />
            </Link>
          ))}
        </aside>

        <div className="portal-ghost-content">
          <div className="portal-detail-header portal-detail-header-dark">
            <AgentPortrait label={agent.label} accent={agent.accent} role={agent.role} />
            <div>
              <p className="eyebrow">{agent.tag}</p>
              <h1>{agent.label}</h1>
              <p>{agent.summary}</p>
            </div>
          </div>

          <div className="portal-story-card">
            {agent.story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <section className="portal-detail-grid">
            <EntryList entries={entries} />
            <EntryUploadForm
              section="ghost-protocol"
              categories={ghostProtocolAgents.map((entry) => ({ slug: entry.slug, label: entry.label }))}
              defaultCategory={agent.slug}
              enabled={portalPersistenceEnabled}
            />
          </section>
        </div>
      </section>
    </main>
  );
}
