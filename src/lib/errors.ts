/**
 * Core Application Error Model
 * Defines unified error classes for domain, validation, security, and repository layers.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = "INTERNAL_ERROR", statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  public readonly fieldErrors?: Record<string, string>;

  constructor(message: string, fieldErrors?: Record<string, string>) {
    super(message, "VALIDATION_ERROR", 400);
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Authentication required or active user status revoked.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden: Insufficient role permissions for this operation.") {
    super(message, "FORBIDDEN", 403);
  }
}

export class NotFoundError extends AppError {
  constructor(entityName: string, identifier?: string) {
    const detail = identifier ? ` with identifier '${identifier}'` : "";
    super(`${entityName}${detail} was not found.`, "NOT_FOUND", 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class DomainInvariantError extends AppError {
  constructor(message: string) {
    super(message, "DOMAIN_INVARIANT_VIOLATION", 422);
  }
}
