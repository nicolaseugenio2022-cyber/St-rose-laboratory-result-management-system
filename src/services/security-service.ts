import { IUserProfile } from "@/domain/models/interfaces";
import { PatientReportSessionAggregate } from "@/domain/models/patient-report-session-aggregate";
import { UnauthorizedError, ForbiddenError, ValidationError } from "@/lib/errors";

/**
 * Security & Role-Based Access Control (RBAC) Service
 * Implements the security architecture and invariants defined in SECURITY_MODEL.md
 */
export class SecurityService {
  /**
   * Security Invariant 1: Ensure caller is an authenticated, active user.
   */
  public validateActiveUser(userProfile?: IUserProfile | null): IUserProfile {
    if (!userProfile) {
      throw new UnauthorizedError("Authentication required to access laboratory system.");
    }

    // Denial auditing is emitted by server-boundary guards, where caller identity is server-resolved.
    if (userProfile.status !== "Active") {
      throw new ForbiddenError("Account is inactive. Access denied.");
    }

    return userProfile;
  }

  /**
   * Security Invariant 7: Ensure user has Admin role for administrative operations.
   */
  public requireAdmin(userProfile: IUserProfile, operationName: string): void {
    this.validateActiveUser(userProfile);

    // Denial auditing is emitted by server-boundary guards, where caller identity is server-resolved.
    if (userProfile.role !== "Admin") {
      throw new ForbiddenError(`Operation '${operationName}' requires Admin role.`);
    }
  }

  /**
   * 30-Day Retention Editability Validation per SECURITY_MODEL.md Section 6.3.
   * Draft sessions are editable.
   * Completed sessions are editable ONLY within the 30-day window (`completed_at + 30 days`).
   * Expired sessions (`expires_at < NOW()`) are strictly immutable.
   */
  public canEditSession(session: PatientReportSessionAggregate, userProfile: IUserProfile): boolean {
    this.validateActiveUser(userProfile);

    if (session.status === "Draft") {
      return true;
    }

    if (session.status === "Completed") {
      if (!session.expiresAt) return true;
      const now = new Date();
      const expires = new Date(session.expiresAt);
      if (now > expires) {
        throw new ValidationError(
          `Patient Report Session '${session.accessionNumber}' has expired (30-day retention window) and is permanently immutable.`
        );
      }
      return true;
    }

    return false;
  }

}

export const securityService = new SecurityService();
