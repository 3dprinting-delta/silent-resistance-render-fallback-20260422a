import { PortalSection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  classIndexCategories,
  ghostProtocolAgents,
  type PortalSectionSlug,
} from "@/lib/portal-config";

export type PortalEntryRecord = {
  id: string;
  section: PortalSectionSlug;
  category: string;
  title: string;
  url: string;
  status: string;
  description?: string | null;
  createdBy?: string | null;
  sortOrder?: number;
  editable?: boolean;
};

export const portalPersistenceEnabled = Boolean(process.env.DATABASE_URL);

const statusPriority: Record<string, number> = {
  broken: 0,
  block: 1,
  blocked: 1,
  ongoing: 2,
  archived: 3,
};

function sectionToEnum(section: PortalSectionSlug) {
  return section === "class-index" ? PortalSection.CLASS_INDEX : PortalSection.GHOST_PROTOCOL;
}

function enumToSection(section: PortalSection) {
  return section === PortalSection.CLASS_INDEX ? "class-index" : "ghost-protocol";
}

export function getClassCategoryBySlug(slug: string) {
  return classIndexCategories.find((entry) => entry.slug === slug) || null;
}

export function getGhostAgentBySlug(slug: string) {
  return ghostProtocolAgents.find((entry) => entry.slug === slug) || null;
}

export async function listPortalEntries(section: PortalSectionSlug, category?: string) {
  if (!portalPersistenceEnabled) {
    return [];
  }

  try {
    const rows = await prisma.portalEntry.findMany({
      where: {
        section: sectionToEnum(section),
        ...(category ? { category } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    const persisted: PortalEntryRecord[] = rows.map((row) => ({
      id: row.id,
      section: enumToSection(row.section),
      category: row.category,
      title: row.title,
      url: row.url,
      status: row.status,
      description: row.description,
      createdBy: row.createdBy,
      sortOrder: row.sortOrder,
      editable: true,
    }));

    return persisted.sort((left, right) => {
      const leftPriority = statusPriority[left.status.trim().toLowerCase()] ?? 99;
      const rightPriority = statusPriority[right.status.trim().toLowerCase()] ?? 99;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftSortOrder = left.sortOrder ?? 0;
      const rightSortOrder = right.sortOrder ?? 0;
      if (leftSortOrder !== rightSortOrder) {
        return leftSortOrder - rightSortOrder;
      }

      return left.title.localeCompare(right.title);
    });
  } catch {
    return [];
  }
}

export async function getPortalCounts(section: PortalSectionSlug) {
  const entries = await listPortalEntries(section);
  return entries.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.category] = (acc[entry.category] || 0) + 1;
    return acc;
  }, {});
}

export async function createPortalEntry(input: {
  section: PortalSectionSlug;
  category: string;
  title: string;
  url: string;
  status: string;
  description?: string | null;
  createdBy: string;
}) {
  if (!portalPersistenceEnabled) {
    throw new Error("Portal persistence is not configured.");
  }

  return prisma.portalEntry.create({
    data: {
      section: sectionToEnum(input.section),
      category: input.category,
      title: input.title,
      url: input.url,
      status: input.status,
      description: input.description || null,
      createdBy: input.createdBy,
    },
  });
}

export async function updatePortalEntryStatus(input: {
  id: string;
  status: string;
  updatedBy: string;
}) {
  if (!portalPersistenceEnabled) {
    throw new Error("Portal persistence is not configured.");
  }

  const existing = await prisma.portalEntry.findUnique({
    where: { id: input.id },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Entry not found.");
  }

  return prisma.portalEntry.update({
    where: { id: input.id },
    data: {
      status: input.status,
    },
  });
}

export async function deletePortalEntry(input: {
  id: string;
}) {
  if (!portalPersistenceEnabled) {
    throw new Error("Portal persistence is not configured.");
  }

  const existing = await prisma.portalEntry.findUnique({
    where: { id: input.id },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Entry not found.");
  }

  await prisma.portalEntry.delete({
    where: { id: input.id },
  });
}
