import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createPortalEntry, deletePortalEntry, portalPersistenceEnabled, updatePortalEntryStatus } from "@/lib/portal-data";

const entrySchema = z.object({
  section: z.enum(["class-index", "ghost-protocol"]),
  category: z.string().min(1).max(64),
  title: z.string().min(1).max(140),
  url: z.string().url(),
  status: z.string().trim().min(1).max(48),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const updateSchema = z.object({
  entryId: z.string().min(1),
  status: z.string().trim().min(1).max(48),
});

const deleteSchema = z.object({
  entryId: z.string().min(1),
});

async function requirePortalUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.username) {
    return null;
  }

  return session;
}

export async function POST(request: Request) {
  const session = await requirePortalUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const username = session.user?.username;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!portalPersistenceEnabled) {
    return NextResponse.json({ error: "Database persistence is not configured." }, { status: 503 });
  }

  const body = await request.json();
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid entry payload." }, { status: 400 });
  }

  const entry = await createPortalEntry({
    ...parsed.data,
    createdBy: username,
  });

  return NextResponse.json({ ok: true, entryId: entry.id });
}

export async function PUT(request: Request) {
  const session = await requirePortalUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const username = session.user?.username;
  if (!username) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!portalPersistenceEnabled) {
    return NextResponse.json({ error: "Database persistence is not configured." }, { status: 503 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update payload." }, { status: 400 });
  }

  try {
    await updatePortalEntryStatus({
      id: parsed.data.entryId,
      status: parsed.data.status,
      updatedBy: username,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update entry.";
    return NextResponse.json({ error: message }, { status: message === "Entry not found." ? 404 : 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requirePortalUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!portalPersistenceEnabled) {
    return NextResponse.json({ error: "Database persistence is not configured." }, { status: 503 });
  }

  const body = await request.json();
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delete payload." }, { status: 400 });
  }

  try {
    await deletePortalEntry({
      id: parsed.data.entryId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete entry.";
    return NextResponse.json({ error: message }, { status: message === "Entry not found." ? 404 : 500 });
  }
}
