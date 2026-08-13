import { 
  IPatientReportSession, 
  IPersonnel, 
  IUserProfile, 
  IReportTemplate, 
  ITemplateParameter, 
  ITemplateSignatoryRequirement 
} from "../../domain/models/interfaces";
import { UserRole, UserStatus } from "../../domain/types";
import { HydratedTemplateSpec } from "../../services/interfaces";

export type AuthRole = "Admin" | "User" | "Developer";
export type AuthStatus = "Active" | "Inactive";

export interface AuthCredentialRecord {
  id: string;
  username: string;
  role: AuthRole;
  status: AuthStatus;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string | null;
  mustChangePassword: boolean;
  mustSetRecovery: boolean;
  tokenVersion: number;
  passwordUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICredentialRepository {
  findById(id: string): Promise<AuthCredentialRecord | null>;
  findByUsername(username: string): Promise<AuthCredentialRecord | null>;
  findAll(): Promise<AuthCredentialRecord[]>;
  create(record: AuthCredentialRecord): Promise<AuthCredentialRecord>;
  update(id: string, updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>): Promise<AuthCredentialRecord>;
  updateIfTokenVersion(
    id: string,
    expectedTokenVersion: number,
    updates: Partial<Omit<AuthCredentialRecord, "id" | "createdAt">>
  ): Promise<AuthCredentialRecord | null>;
  delete(id: string): Promise<void>;
}

export interface ICredentialDirectoryRepository {
  findVisibleTo(visibleRoles: AuthRole[]): Promise<AuthCredentialRecord[]>;
  countVisibleTo(visibleRoles: AuthRole[]): Promise<number>;
  summarizeVisibleTo?(visibleRoles: AuthRole[]): Promise<CredentialDirectorySummary>;
  findByIdVisibleTo(
    id: string,
    visibleRoles: AuthRole[]
  ): Promise<AuthCredentialRecord | null>;
  listDeveloperIdentities(): Promise<{ id: string; username: string }[]>;
}

export interface CredentialDirectorySummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
}

export type AuthAttemptKind = "Login" | "RecoveryLookup" | "RecoveryAnswer" | "PasswordReset";

export interface AuthAttemptRecord {
  id: string;
  username: string;
  attemptKind: AuthAttemptKind;
  succeeded: boolean;
  clientIp: string | null;
  attemptedAt: string;
}

export interface AuthAttemptQuery {
  attemptKind: AuthAttemptKind;
  since: string;
  username?: string;
  clientIp?: string;
}

export interface ILoginAttemptRepository {
  record(attempt: AuthAttemptRecord): Promise<AuthAttemptRecord>;
  findAttempts(query: AuthAttemptQuery): Promise<AuthAttemptRecord[]>;
}

export type AuditLogEntry = {
  id: string;
  category: string;
  eventType: string;
  performedByUserId: string | null;
  performedByUsername: string | null;
  targetReference: string | null;
  actorRole?: AuthRole | null;
  targetRole?: AuthRole | null;
  details: Record<string, unknown> | null;
  occurredAt: string;
};

export interface IAuditLogRepository {
  append(entry: AuditLogEntry): Promise<void>;
}

export type AuditLogQueryExclusion = {
  excludeDeveloperInvolved: true;
  performedByUserIds: string[];
  usernames: string[];
};

export type AuditLogQueryCriteria = {
  categories?: string[];
  eventType?: string;
  occurredAtFrom?: string;
  occurredAtTo?: string;
  search?: string;
  exclusion?: AuditLogQueryExclusion;
  limit: number;
  offset: number;
};

export interface IAuditLogQueryRepository {
  query(criteria: AuditLogQueryCriteria): Promise<AuditLogEntry[]>;
  count(criteria: AuditLogQueryCriteria): Promise<number>;
}

export interface IPatientReportSessionRepository {
  findById(id: string): Promise<IPatientReportSession | null>;
  findByAccessionNumber(accessionNumber: string): Promise<IPatientReportSession | null>;
  findActiveCompletedSessions(): Promise<IPatientReportSession[]>;
  saveDraft(session: IPatientReportSession): Promise<IPatientReportSession>;
  completeSession(session: IPatientReportSession): Promise<IPatientReportSession>;
  replaceSession(session: IPatientReportSession): Promise<IPatientReportSession>;
  purgeExpiredSessions(): Promise<number>; // Returns count of purged sessions
}

export interface IPersonnelRepository {
  findById(id: string): Promise<IPersonnel | null>;
  findAllActive(): Promise<IPersonnel[]>;
  findAll(): Promise<IPersonnel[]>;
  create(personnel: Omit<IPersonnel, "id" | "createdAt" | "updatedAt">): Promise<IPersonnel>;
  update(id: string, updates: Partial<IPersonnel>): Promise<IPersonnel>;
  toggleActiveStatus(id: string, isActive: boolean): Promise<IPersonnel>;
}

export interface IUserProfileRepository {
  findById(id: string): Promise<IUserProfile | null>;
  findByUsername(username: string): Promise<IUserProfile | null>;
  findAll(): Promise<IUserProfile[]>;
  createProfile(profile: Omit<IUserProfile, "createdAt" | "updatedAt">): Promise<IUserProfile>;
  updateRole(id: string, role: UserRole): Promise<IUserProfile>;
  updateStatus(id: string, status: UserStatus): Promise<IUserProfile>;
}

export interface IReportRegistryRepository {
  getTemplateByCode(templateCode: string): Promise<IReportTemplate | null>;
  getParametersByTemplateCode(templateCode: string): Promise<ITemplateParameter[]>;
  getSignatoryRequirementByTemplateCode(templateCode: string): Promise<ITemplateSignatoryRequirement | null>;
  getAllActiveTemplates(): Promise<IReportTemplate[]>;
  getAllHydratedTemplates?(): Promise<HydratedTemplateSpec[]>;
}
