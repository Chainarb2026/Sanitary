import type { Logger } from "pino";
import type { UserRole } from "@sanitary/shared";

declare global {
  namespace Express {
    interface RequestUser {
      userId: string;
      role: UserRole;
      phone: string;
    }

    interface Request {
      id: string;
      log: Logger;
      user?: RequestUser;
      rawBody?: string;
    }
  }
}
