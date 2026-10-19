import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { UnauthorizedError, ForbiddenError } from "../errors/appError.js";
import type { UserRole } from "@sanitary/shared";

/**
 * Authentication middleware verifying Bearer access tokens and binding user context.
 * Big-O: O(1) JWT verification.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or malformed Authorization header"));
    return;
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      role: payload.role,
      phone: payload.phone,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * RBAC authorization middleware guarding routes based on allowed user roles.
 * Big-O: O(1) array lookup.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError("Authentication required before authorization check"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Access forbidden: required one of [${allowedRoles.join(", ")}], but user possesses '${req.user.role}'`,
        ),
      );
      return;
    }

    next();
  };
}
