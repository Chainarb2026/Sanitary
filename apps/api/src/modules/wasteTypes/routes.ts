import { Router } from "express";
import { wasteTypeController } from "./controller.js";
import { authenticate, requireRole } from "../../middlewares/auth.js";

export const wasteTypeRouter = Router();

// Public / Client catalog and quote routes
wasteTypeRouter.get("/waste-types", (req, res, next) =>
  wasteTypeController.getActiveCatalog(req, res, next),
);

wasteTypeRouter.post("/waste-types/quote", (req, res, next) =>
  wasteTypeController.calculateQuote(req, res, next),
);

wasteTypeRouter.get(
  "/waste-types/admin/all",
  authenticate,
  requireRole("admin"),
  (req, res, next) => wasteTypeController.getAllForAdmin(req, res, next),
);

wasteTypeRouter.get("/waste-types/:id", (req, res, next) =>
  wasteTypeController.getById(req, res, next),
);

// Admin-only management endpoints
wasteTypeRouter.post("/waste-types", authenticate, requireRole("admin"), (req, res, next) =>
  wasteTypeController.create(req, res, next),
);

wasteTypeRouter.put("/waste-types/:id", authenticate, requireRole("admin"), (req, res, next) =>
  wasteTypeController.update(req, res, next),
);

wasteTypeRouter.delete("/waste-types/:id", authenticate, requireRole("admin"), (req, res, next) =>
  wasteTypeController.delete(req, res, next),
);
