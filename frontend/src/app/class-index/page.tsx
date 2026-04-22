import Link from "next/link";
import { PortalNav } from "@/components/portal/PortalNav";
import { ClassificationIcon } from "@/components/portal/ClassificationIcon";
import { EntryUploadForm } from "@/components/portal/EntryUploadForm";
import { classIndexCategories } from "@/lib/portal-config";
import { getPortalCounts, portalPersistenceEnabled } from "@/lib/portal-data";
import { requirePortalSession } from "@/lib/require-portal-session";

export default async function ClassIndexPage() {
  await requirePortalSession("/class-index");
  const counts = await getPortalCounts("class-index");

  return (
    <main className="portal-shell portal-shell-index">
      <PortalNav active="class-index" />

      <section className="portal-section-heading portal-section-heading-light">
        <div>
          <p className="eyebrow">Class Index</p>
          <h1>Grading level</h1>
          <p>Choose a risk class to open the linked file list, inspect statuses, and add new subsystems to that class.</p>
        </div>
      </section>

      <section className="portal-index-grid">
        <div className="portal-icon-grid">
          {classIndexCategories.map((category) => (
            <Link key={category.slug} href={`/class-index/${category.slug}`} className="portal-icon-card">
              <ClassificationIcon variant={category.slug} label={category.label} size="large" />
              <h3>{category.label}</h3>
              <p>{category.description}</p>
              <span className="portal-meta-pill">{counts[category.slug] || 0} entries</span>
            </Link>
          ))}
        </div>

        <EntryUploadForm
          section="class-index"
          categories={classIndexCategories.map((category) => ({ slug: category.slug, label: category.label }))}
          enabled={portalPersistenceEnabled}
        />
      </section>
    </main>
  );
}
