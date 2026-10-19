import { AppError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
  }

  public getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
      this.state = "HALF_OPEN";
      logger.info("Circuit breaker transitioned to HALF_OPEN");
    }
    return this.state;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      logger.warn("Circuit breaker is OPEN. Rejecting call early.");
      throw new AppError(
        503,
        "CIRCUIT_BREAKER_OPEN",
        "AI estimation service is temporarily unavailable (circuit open)",
      );
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      logger.info("Circuit breaker test call succeeded. Transitioning to CLOSED.");
    }
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  private onFailure(err: unknown): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    logger.warn({ failureCount: this.failureCount, err }, "Circuit breaker recorded failure");

    if (this.failureCount >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      logger.error(
        { resetTimeoutMs: this.resetTimeoutMs },
        "Circuit breaker tripped. Transitioning to OPEN.",
      );
    }
  }

  public reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}
