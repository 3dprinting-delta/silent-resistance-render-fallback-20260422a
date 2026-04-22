import { AccessRequestStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPortalEmail } from "@/lib/portal-mail";

const TEMP_SESSION_MINUTES = 5;

export type AccessRequestListRecord = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  deviceLabel: string;
  claimedIpAddress: string;
  requestPrompt: string;
  status: AccessRequestStatus;
  approvedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  credential: {
    username: string;
    consumedAt: Date | null;
    accessExpiresAt: Date | null;
    createdBy: string;
  } | null;
};

function getAlertInbox() {
  return process.env.ALERT_EMAIL_TO || "375351feng@gmail.com";
}

function createTemporaryUsername() {
  return `req-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`.toLowerCase();
}

function createTemporaryPassword() {
  return randomBytes(9).toString("base64url");
}

export async function createAccessRequest(input: {
  requesterName: string;
  requesterEmail: string;
  deviceLabel: string;
  claimedIpAddress: string;
  requestPrompt: string;
}) {
  const request = await prisma.accessRequest.create({
    data: input,
  });

  const emailResult = await sendPortalEmail({
    to: getAlertInbox(),
    subject: "Kappa-4 access request submitted",
    text: [
      "A new 5-minute access request was submitted.",
      "",
      `Request ID: ${request.id}`,
      `Name: ${request.requesterName}`,
      `Email: ${request.requesterEmail}`,
      `Device: ${request.deviceLabel}`,
      `Claimed IP: ${request.claimedIpAddress}`,
      `Submitted at: ${request.createdAt.toISOString()}`,
      "",
      "Request prompt:",
      request.requestPrompt,
    ].join("\n"),
  });

  return { request, emailResult };
}

export async function listAccessRequests() {
  const rows = await prisma.accessRequest.findMany({
    include: {
      credential: {
        select: {
          username: true,
          consumedAt: true,
          accessExpiresAt: true,
          createdBy: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return rows as AccessRequestListRecord[];
}

export async function approveAccessRequest(input: {
  requestId: string;
  approvedBy: string;
}) {
  const request = await prisma.accessRequest.findUnique({
    where: { id: input.requestId },
    include: { credential: true },
  });

  if (!request) {
    throw new Error("Request not found.");
  }

  if (request.status !== AccessRequestStatus.PENDING) {
    throw new Error("Request has already been approved.");
  }

  let username = createTemporaryUsername();
  while (await prisma.temporaryAccessCredential.findUnique({ where: { username } })) {
    username = createTemporaryUsername();
  }

  const password = createTemporaryPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  const approved = await prisma.$transaction(async (tx) => {
    const credential = await tx.temporaryAccessCredential.create({
      data: {
        requestId: request.id,
        username,
        passwordHash,
        createdBy: input.approvedBy,
      },
    });

    const updatedRequest = await tx.accessRequest.update({
      where: { id: request.id },
      data: {
        status: AccessRequestStatus.APPROVED,
        approvedBy: input.approvedBy,
        approvedAt: new Date(),
      },
    });

    return {
      request: updatedRequest,
      credential,
    };
  });

  const emailResult = await sendPortalEmail({
    to: getAlertInbox(),
    subject: "Kappa-4 one-time access approved",
    text: [
      "A 5-minute one-time access request was approved.",
      "",
      `Request ID: ${approved.request.id}`,
      `Approved by: ${input.approvedBy}`,
      `Requester: ${request.requesterName}`,
      `Requester email: ${request.requesterEmail}`,
      `Device: ${request.deviceLabel}`,
      `Claimed IP: ${request.claimedIpAddress}`,
      "",
      `One-time username: ${username}`,
      `One-time password: ${password}`,
      "",
      "These credentials will work once. The 5-minute session starts on first successful login, and the credentials cannot be reused after that session locks or ends.",
    ].join("\n"),
  });

  return {
    request: approved.request,
    username,
    password,
    emailResult,
  };
}

export async function findTemporaryCredential(username: string) {
  return prisma.temporaryAccessCredential.findUnique({
    where: { username },
    include: { request: true },
  });
}

export async function consumeTemporaryCredential(input: {
  credentialId: string;
}) {
  const accessExpiresAt = new Date(Date.now() + TEMP_SESSION_MINUTES * 60 * 1000);
  const consumedAt = new Date();

  const updated = await prisma.temporaryAccessCredential.updateMany({
    where: {
      id: input.credentialId,
      consumedAt: null,
    },
    data: {
      consumedAt,
      accessExpiresAt,
    },
  });

  if (!updated.count) {
    return null;
  }

  return {
    consumedAt,
    accessExpiresAt,
  };
}
