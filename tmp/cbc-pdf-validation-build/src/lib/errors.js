"use strict";
/**
 * Core Application Error Model
 * Defines unified error classes for domain, validation, security, and repository layers.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomainInvariantError = exports.ConflictError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, code = "INTERNAL_ERROR", statusCode = 500) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, fieldErrors) {
        super(message, "VALIDATION_ERROR", 400);
        this.fieldErrors = fieldErrors;
    }
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends AppError {
    constructor(message = "Authentication required or active user status revoked.") {
        super(message, "UNAUTHORIZED", 401);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = "Forbidden: Insufficient role permissions for this operation.") {
        super(message, "FORBIDDEN", 403);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(entityName, identifier) {
        const detail = identifier ? ` with identifier '${identifier}'` : "";
        super(`${entityName}${detail} was not found.`, "NOT_FOUND", 404);
    }
}
exports.NotFoundError = NotFoundError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, "CONFLICT", 409);
    }
}
exports.ConflictError = ConflictError;
class DomainInvariantError extends AppError {
    constructor(message) {
        super(message, "DOMAIN_INVARIANT_VIOLATION", 422);
    }
}
exports.DomainInvariantError = DomainInvariantError;
