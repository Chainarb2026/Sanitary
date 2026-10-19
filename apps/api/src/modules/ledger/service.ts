import mongoose, { type ClientSession } from "mongoose";
import { type Paise } from "@sanitary/shared";
import {
  LedgerEntryModel,
  type ILedgerEntry,
  type LedgerAccountType,
  type LedgerEntryType,
} from "./model.js";
import { getRedisClient } from "../../infra/redis.js";
import { AppError } from "../../errors/appError.js";
import { logger } from "../../infra/logger.js";

export const WALLET_CACHE_TTL_SECONDS = 300; // 5 minutes snapshot cache
export const WALLET_CACHE_KEY_PREFIX = "wallet:balance:";

export interface LedgerEntryInput {
  accountType: LedgerAccountType;
  accountId: string;
  type: LedgerEntryType;
  amountPaise: Paise;
  idempotencyKey: string;
  description: string;
  metadata?: Record<string, unknown>;
}

export interface RecordTransactionParams {
  transactionId: string;
  entries: LedgerEntryInput[];
  session?: ClientSession;
}

export class LedgerService {
  /**
   * Records a balanced double-entry transaction inside a MongoDB transaction.
   * Enforces: sum(debits) === sum(credits).
   * Big-O: O(E) where E is number of entries in transaction.
   */
  public async recordTransaction(params: RecordTransactionParams): Promise<ILedgerEntry[]> {
    const { transactionId, entries, session: callerSession } = params;

    if (entries.length < 2) {
      throw new AppError(
        400,
        "INVALID_LEDGER_TRANSACTION",
        "A double-entry ledger transaction requires at least 2 entries",
      );
    }

    // 1. Invariant check: Sum of debits MUST equal sum of credits
    let totalDebits: Paise = 0;
    let totalCredits: Paise = 0;

    for (const entry of entries) {
      if (entry.amountPaise <= 0) {
        throw new AppError(
          400,
          "INVALID_AMOUNT",
          `Ledger amount must be strictly positive integer paise: received ${entry.amountPaise}`,
        );
      }
      if (entry.type === "debit") {
        totalDebits += entry.amountPaise;
      } else {
        totalCredits += entry.amountPaise;
      }
    }

    if (totalDebits !== totalCredits) {
      throw new AppError(
        400,
        "LEDGER_IMBALANCE",
        `Double-entry imbalance: total debits (${totalDebits}) does not equal total credits (${totalCredits})`,
      );
    }

    // 2. Check if transaction has already been recorded (idempotency check by first idempotency key)
    const firstKey = entries[0]?.idempotencyKey;
    if (firstKey) {
      const existing = await LedgerEntryModel.findOne({ idempotencyKey: firstKey })
        .session(callerSession ?? null)
        .lean()
        .exec();
      if (existing) {
        logger.info(
          { transactionId, idempotencyKey: firstKey },
          "Ledger transaction already exists. Returning existing records (idempotent replay).",
        );
        const allExisting = await LedgerEntryModel.find({ transactionId })
          .session(callerSession ?? null)
          .exec();
        return allExisting;
      }
    }

    // 3. Execute insertion inside transaction
    let createdEntries: ILedgerEntry[] = [];

    if (callerSession) {
      createdEntries = await this.insertEntries(transactionId, entries, callerSession);
    } else {
      const session = await mongoose.startSession();
      try {
        try {
          await session.withTransaction(async () => {
            createdEntries = await this.insertEntries(transactionId, entries, session);
          });
        } catch (err: unknown) {
          // Fallback for standalone Mongo test environments without replica sets
          if (err instanceof Error && err.message.includes("replica set")) {
            createdEntries = await this.insertEntries(transactionId, entries);
          } else {
            throw err;
          }
        }
      } finally {
        await session.endSession();
      }
    }

    // 4. Invalidate Redis wallet balance caches for all affected accounts
    await this.invalidateCachesForEntries(entries);

    return createdEntries;
  }

  private async insertEntries(
    transactionId: string,
    entries: LedgerEntryInput[],
    session?: ClientSession,
  ): Promise<ILedgerEntry[]> {
    const docs = entries.map((entry) => ({
      transactionId,
      accountType: entry.accountType,
      accountId: entry.accountId,
      type: entry.type,
      amountPaise: entry.amountPaise,
      currency: "INR",
      idempotencyKey: entry.idempotencyKey,
      description: entry.description,
      metadata: entry.metadata ?? {},
    }));

    return LedgerEntryModel.insertMany(docs, { session: session ?? null, ordered: true });
  }

  /**
   * Retrieves account wallet balance.
   * Balance = sum(credits) - sum(debits).
   * Checked against Redis snapshot cache first, computing from MongoDB on cache miss.
   * Big-O: O(1) cache hit, O(E) aggregation on cache miss.
   */
  public async getBalance(accountType: LedgerAccountType, accountId: string): Promise<Paise> {
    const redis = getRedisClient();
    const cacheKey = `${WALLET_CACHE_KEY_PREFIX}${accountType}:${accountId}`;

    // 1. Try reading cached balance snapshot
    try {
      const cached = await redis.get(cacheKey);
      if (cached !== null && cached !== undefined) {
        return parseInt(cached, 10);
      }
    } catch (err) {
      logger.warn(
        { err, accountType, accountId },
        "Failed to read wallet balance from Redis cache",
      );
    }

    // 2. Aggregate from append-only ledger entries in MongoDB
    const aggregationResult = await LedgerEntryModel.aggregate<{
      _id: LedgerEntryType;
      total: Paise;
    }>([
      {
        $match: {
          accountType,
          accountId,
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amountPaise" },
        },
      },
    ]).exec();

    let credits: Paise = 0;
    let debits: Paise = 0;

    for (const group of aggregationResult) {
      if (group._id === "credit") {
        credits = group.total;
      } else if (group._id === "debit") {
        debits = group.total;
      }
    }

    const balance: Paise = credits - debits;

    // 3. Cache snapshot in Redis
    try {
      await redis.set(cacheKey, balance.toString(), "EX", WALLET_CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn(
        { err, accountType, accountId },
        "Failed to cache wallet balance snapshot in Redis",
      );
    }

    return balance;
  }

  /**
   * Invalids cached wallet balance for a specific account.
   */
  public async invalidateBalanceCache(
    accountType: LedgerAccountType,
    accountId: string,
  ): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = `${WALLET_CACHE_KEY_PREFIX}${accountType}:${accountId}`;
    try {
      await redis.del(cacheKey);
    } catch (err) {
      logger.warn({ err, cacheKey }, "Failed to invalidate wallet balance cache in Redis");
    }
  }

  private async invalidateCachesForEntries(entries: LedgerEntryInput[]): Promise<void> {
    const uniqueAccounts = new Set<string>();
    for (const entry of entries) {
      uniqueAccounts.add(`${entry.accountType}:${entry.accountId}`);
    }

    await Promise.all(
      Array.from(uniqueAccounts).map(async (key) => {
        const [accountType, accountId] = key.split(":") as [LedgerAccountType, string];
        await this.invalidateBalanceCache(accountType, accountId);
      }),
    );
  }
}

export const ledgerService = new LedgerService();
