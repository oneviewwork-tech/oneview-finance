import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface WriteAuditEventInput {
  entityType: string;
  entityId: string;
  action: AuditAction;
  // Nullable for pre-authentication events (a failed login against an
  // email that isn't a real account still needs an audit trail, but there
  // is no user id to attach it to).
  actorUserId: string | null;
  actorEmail: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

/**
 * Appends one audit row. Always called inside the same DB transaction as
 * the mutation it's describing, using the transactional client (`tx`), so
 * an audit write can never succeed while its underlying change fails (or
 * vice versa). AuditEvent has no update/delete path anywhere in this
 * codebase — it is append-only by construction, not just convention.
 */
export async function writeAuditEvent(tx: Tx, input: WriteAuditEventInput) {
  await tx.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
