import "server-only";

import type {
  AuditLogEntry,
  AuditLogQueryCriteria,
  IAuditLogQueryRepository,
  ICredentialDirectoryRepository,
} from "@/repositories/interfaces";

export const AUDIT_CATEGORIES = [
  "AuthAccount",
  "PersonnelCredential",
  "SessionReport",
  "SecurityDenial",
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
export type AuditCategoryFilter = AuditCategory | "ALL";
export type AuditReaderRole = "Admin" | "Developer";

export function toAuditReaderRole(role: unknown): AuditReaderRole | null {
  return role === "Admin" || role === "Developer" ? role : null;
}

export type AuditReadCriteria = {
  category: AuditCategoryFilter;
  eventType?: string;
  from?: string;
  to?: string;
  search?: string;
  limit: number;
  offset: number;
};

export type AuditEventTransport = Omit<
  AuditLogEntry,
  "category" | "details" | "actorRole" | "targetRole"
> & {
  category: AuditCategory;
  actorRole: "Admin" | "User" | "Developer" | null;
  targetRole: "Admin" | "User" | "Developer" | null;
  details: Record<string, unknown> | null;
};

export type AuditPageTransport = {
  events: AuditEventTransport[];
  total: number;
};

const SENSITIVE_DETAIL_KEY = /pass(word)?|answer|hash|secret|token(?!Version)|cookie/i;
const REDACTED_VALUE = "[REDACTED]";

function canonicalCategory(category: string): AuditCategory {
  return (category === "Authentication" ? "AuthAccount" : category) as AuditCategory;
}

function redactDetailsValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDetailsValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_DETAIL_KEY.test(key) ? REDACTED_VALUE : redactDetailsValue(nestedValue),
    ])
  );
}

function redactDetails(details: Record<string, unknown> | null): Record<string, unknown> | null {
  return details ? (redactDetailsValue(details) as Record<string, unknown>) : null;
}

function toTransport(entry: AuditLogEntry): AuditEventTransport {
  return {
    id: entry.id,
    category: canonicalCategory(entry.category),
    eventType: entry.eventType,
    performedByUserId: entry.performedByUserId,
    performedByUsername: entry.performedByUsername,
    targetReference: entry.targetReference,
    actorRole: entry.actorRole ?? null,
    targetRole: entry.targetRole ?? null,
    details: redactDetails(entry.details),
    occurredAt: entry.occurredAt,
  };
}

function storedCategoriesFor(category: AuditCategoryFilter): string[] | undefined {
  if (category === "ALL") return undefined;
  if (category === "AuthAccount") return ["AuthAccount", "Authentication"];
  return [category];
}

export class AuditReadService {
  constructor(
    private readonly auditLogs: IAuditLogQueryRepository,
    private readonly credentialDirectory: ICredentialDirectoryRepository
  ) {}

  async readPage(
    criteria: AuditReadCriteria,
    readerRole: AuditReaderRole
  ): Promise<AuditPageTransport> {
    const queryCriteria: AuditLogQueryCriteria = {
      categories: storedCategoriesFor(criteria.category),
      eventType: criteria.eventType,
      occurredAtFrom: criteria.from,
      occurredAtTo: criteria.to,
      search: criteria.search,
      limit: criteria.limit,
      offset: criteria.offset,
    };

    if (readerRole === "Admin") {
      const developerIdentities = await this.credentialDirectory.listDeveloperIdentities();
      queryCriteria.exclusion = {
        performedByUserIds: [...new Set(developerIdentities.map(({ id }) => id))],
        usernames: [...new Set(developerIdentities.map(({ username }) => username))],
      };
    }

    const [entries, total] = await Promise.all([
      this.auditLogs.query(queryCriteria),
      this.auditLogs.count(queryCriteria),
    ]);

    return {
      events: entries.map(toTransport),
      total,
    };
  }
}
