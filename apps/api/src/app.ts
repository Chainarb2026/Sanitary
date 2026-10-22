import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./infra/config.js";
import { requestIdMiddleware } from "./middlewares/requestId.js";
import { requestLoggerMiddleware } from "./middlewares/requestLogger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { NotFoundError } from "./errors/appError.js";
import { healthRouter } from "./modules/health/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { wasteTypeRouter } from "./modules/wasteTypes/routes.js";
import { partnerRouter } from "./modules/partners/routes.js";
import { addressRouter } from "./modules/addresses/routes.js";
import { bookingRouter } from "./modules/bookings/routes.js";
import { paymentRouter } from "./modules/payments/routes.js";
import { payoutRouter } from "./modules/payouts/routes.js";
import { aiRouter } from "./modules/ai/routes.js";
import { uploadRouter } from "./modules/uploads/routes.js";
import { geoRouter } from "./modules/geo/routes.js";

/**
 * Creates and configures the Express application instance.
 */
export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration (strip trailing slashes automatically to prevent CORS header mismatch)
  const allowedOrigins = config.CORS_ORIGINS.split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else if (
          config.NODE_ENV !== "production" &&
          (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin))
        ) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
    }),
  );

  // Body parsers
  app.use(
    express.json({
      limit: "1mb",
      verify: (req: express.Request, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Tracing & Logging
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Mount Application Routes
  app.use(healthRouter);
  app.use(authRouter);
  app.use(wasteTypeRouter);
  app.use(partnerRouter);
  app.use(addressRouter);
  app.use("/bookings", bookingRouter);
  app.use(paymentRouter);
  app.use(payoutRouter);
  app.use(aiRouter);
  app.use(uploadRouter);
  app.use(geoRouter);

  // 404 Catch-all handler
  app.use((_req, _res, next) => {
    next(new NotFoundError("Endpoint not found"));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
