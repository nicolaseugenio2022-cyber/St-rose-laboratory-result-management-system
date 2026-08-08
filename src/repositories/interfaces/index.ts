import { 
  IPatientReportSession, 
  IPersonnel, 
  IUserProfile, 
  IReportTemplate, 
  ITemplateParameter, 
  ITemplateSignatoryRequirement 
} from "../../domain/models/interfaces";
import { UserRole, UserStatus } from "../../domain/types";

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
}
