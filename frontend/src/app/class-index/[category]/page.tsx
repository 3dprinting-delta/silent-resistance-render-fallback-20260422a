import { notFound } from "next/navigation";
import { PortalNav } from "@/components/portal/PortalNav";
import { ClassificationIcon } from "@/components/portal/ClassificationIcon";
import { EntryList } from "@/components/portal/EntryList";
import { EntryUploadForm } from "@/components/portal/EntryUploadForm";
import { classIndexCategories } from "@/lib/portal-config";
import { getClassCategoryBySlug, listPortalEntries, portalPersistenceEnabled } from "@/lib/portal-data";
import { requirePortalSession } from "@/lib/require-portal-session";

export default async function ClassCategoryPage({ params }: { params: { category: string } }) {
  await requirePortalSession(`/class-index/${params.category}`);
  const category = getClassCategoryBySlug(params.category);
  if (!category) {
    notFound();
  }

  const entries = await listPortalEntries("class-index", category.slug);

  return (
    <main className="portal-shell portal-shell-detail portal-shell-detail-light">
      <PortalNav active="class-index" />

      <section className="portal-detail-header portal-detail-header-light">
        <ClassificationIcon variant={category.slug} label={category.label} size="large" />
        <div>
          <p className="eyebrow">Classification</p>
          <h1>{category.label}</h1>
          <p>{category.description}</p>
        </div>
      </section>

      <section className="portal-detail-grid">
        <EntryList entries={entries} />
        <EntryUploadForm
          section="class-index"
          categories={classIndexCategories.map((entry) => ({ slug: entry.slug, label: entry.label }))}
          defaultCategory={category.slug}
          enabled={portalPersistenceEnabled}
        />
      </section>
    </main>
  );
}
