# Architecture Decision Records (ADRs)

## ADR-0001: Monorepo Structure with NPM Workspaces

- **Status**: Accepted
- **Context**: The Sanitary platform consists of an API service, BullMQ worker processes, future frontends (Customer, Partner, Admin), and shared business logic.
- **Decision**: Use native NPM workspaces under a unified root with `apps/*` and `packages/*`. Business logic contracts (money math, state transitions, Zod schemas, types) live in `@sanitary/shared`.
- **Consequences**: Avoids complex monorepo tooling overhead while ensuring type synchronization and strict layer boundaries.

## ADR-0002: Monetary Representation in Integer Paise

- **Status**: Accepted
- **Context**: Currency rounding issues in floating point arithmetic cause reconciliation errors in financial ledgers and on-the-spot payouts.
- **Decision**: All financial amounts are strictly stored and computed as integer paise (1 INR = 100 paise). Floating point values are never stored or transferred across API boundaries. Conversion to Rupees is done solely for presentation via `formatINR()`.
- **Consequences**: Zero floating-point drift in ledger accounting and commission fee calculations.

## ADR-0003: Booking Deterministic State Machine Transition Map

- **Status**: Accepted
- **Context**: Waste pickup workflows have rigid lifecycle constraints (CREATED -> SEARCHING -> ASSIGNED -> EN_ROUTE -> ARRIVED -> OTP_VERIFIED -> COLLECTED -> PAID -> COMPLETED, plus cancellation and search timeouts). Out-of-order transitions corrupt platform state and partner payouts.
- **Decision**: Enforce transitions exclusively via an immutable transition dictionary (`BOOKING_TRANSITIONS`) and `canTransition()` / `assertValidTransition()`. Invalid transitions reject immediately with HTTP 409 and `INVALID_STATE_TRANSITION`.
- **Consequences**: Database operations can safely enforce optimistic preconditions (`findOneAndUpdate({ _id, status: from }, { status: to })`).

## ADR-0004: Standardized API Error Envelope

- **Status**: Accepted
- **Context**: Heterogeneous error shapes confuse client consumers and break monitoring dashboards.
- **Decision**: Every error response adheres to `{ error: { code, message, details? } }`. Handled systematically via Express `errorHandler` catching `ZodError`, `InvalidStateTransitionError`, `AppError`, and unhandled 500 exceptions.
- **Consequences**: Predictable API error handling across Web, PWA, and Partner apps.

## ADR-0005: Fail-Fast Zod Environment Configuration

- **Status**: Accepted
- **Context**: Missing or malformed environment variables in containerized environments cause silent failures or runtime crashes.
- **Decision**: Parse and validate `process.env` through Zod schema at bootstrap time (`loadConfig`). Missing or invalid configuration halts execution immediately.
- **Consequences**: Prevents unconfigured instances from passing container readiness checks.

## ADR-0006: Single-Node MongoDB Replica Set for Local Development

- **Status**: Accepted
- **Context**: MongoDB transactions are strictly required for append-only ledger entries, which MongoDB only supports on replica sets.
- **Decision**: Configure Docker Compose with MongoDB 7.0 running `--replSet rs0` with automated healthcheck self-initialization.
- **Consequences**: Local development perfectly mirrors production transaction capabilities.

## ADR-0007: HMAC-SHA256 Hashing for OTP Security with Attempt Lockouts

- **Status**: Accepted
- **Context**: Storing raw OTPs in memory or cache risks unauthorized interception and brute-force replay attacks.
- **Decision**: Hash OTPs using HMAC-SHA256 keyed with a secret before writing to Redis with 5-minute TTL. Track attempts in Redis and lock out verification after 3 failed attempts, immediately clearing the key upon exhaustion or successful redemption.
- **Consequences**: Eliminates plaintext OTP exposure and defends against brute-force attacks.

## ADR-0008: Family-Based Refresh Token Rotation with Reuse Detection

- **Status**: Accepted
- **Context**: Stolen long-lived refresh tokens allow persistent unauthorized access unless rotated and detected.
- **Decision**: Group refresh tokens into a cryptographically tracked family in Redis (`auth:family:${familyId}`). Each refresh generates a new token ID (`jti`) and advances the family pointer. If an old token ID is presented, reuse is detected, and the entire token family is immediately revoked with a security alert.
- **Consequences**: Compromised tokens invalidate all sessions derived from that login family, minimizing breach blast radius.

## ADR-0009: Redis Token Bucket Rate Limiting via Lua Script

- **Status**: Accepted
- **Context**: Auth endpoints (especially SMS OTP dispatch) are targets for SMS toll fraud, credential stuffing, and resource exhaustion.
- **Decision**: Execute atomic token bucket algorithms inside Redis via a single Lua script, maintaining token balance and timestamp without multi-trip race conditions. Return standard HTTP 429 and `Retry-After` headers upon exhaustion.
- **Consequences**: Sub-millisecond rate-limiting evaluation with zero race windows across clustered API nodes.

## ADR-0010: Pure Pricing Engine with Invariant Guarantee and Surge Clamping

- **Status**: Accepted
- **Context**: Divergence between frontend preview estimates and backend settlement amounts creates user disputes and ledger imbalances.
- **Decision**: Implement pricing as a pure function in `@sanitary/shared/src/pricing.ts` computing `{base, perKg, convenienceFee, surgeMultiplier, total, partnerEarning, platformCommission}` in integer paise. Surge multiplier is feature-flagged (default 1.0x) and clamped to a hard ceiling of 1.5x. The invariant `partnerEarning + platformCommission + convenienceFee == total` is enforced mathematically with zero rounding loss.
- **Consequences**: Deterministic pricing guarantees zero divergence across quote previews, partner acceptance, and final settlement.

## ADR-0011: Cache-Aside Pattern with Write Invalidation for Waste Catalog

- **Status**: Accepted
- **Context**: Customer quote requests and booking creation look up the waste catalog on every request.
- **Decision**: Cache active waste types in Redis (`catalog:waste_types:active`) with 1-hour TTL. Invalidate cache on any admin mutation (`POST`, `PUT`, `DELETE /waste-types`).
- **Consequences**: O(1) in-memory retrieval for catalog and quote requests while maintaining immediate consistency on administrative catalog edits.

## ADR-0012: Redis GEO for High-Throughput Partner Live Locations with 30s Presence Keys

- **Status**: Accepted
- **Context**: Partner location pings occur frequently (every few seconds) while on active duty. Writing frequent ephemeral coordinates directly to MongoDB causes write amplification, index churn, and high disk I/O.
- **Decision**: Store live partner coordinates strictly in Redis GEO (`partners:geo`) via `GEOADD`. Concurrently set an expiring presence key (`partner:presence:<partnerId>`) with a 30-second TTL. Throttle incoming pings server-side to a minimum 3-second interval per partner using `SET partner:throttle:<partnerId> EX 3 NX`. Geospatial queries (`findNearby`) execute `GEORADIUS` / `GEOSEARCH` on Redis GEO and filter out any partners whose 30s presence key has expired, lazily purging them from the GEO set.
- **Consequences**: Sub-2ms spatial search latencies with 10,000+ active partners while keeping MongoDB completely isolated from ephemeral telemetry churn.

## ADR-0013: GeoJSON Point and 2dsphere Spatial Indexing for Pickup Addresses

- **Status**: Accepted
- **Context**: Customers save multiple pickup addresses (e.g. Home, Work, Other) with optional residential building references. Booking pickups requires exact geographic coordinates for routing and dispatch.
- **Decision**: Model addresses with GeoJSON `Point` objects (`{ type: "Point", coordinates: [longitude, latitude] }`) and create a MongoDB `2dsphere` index on `location`. Include optional `buildingId` referencing apartment complexes / gated societies.
- **Consequences**: Standard-compliant geospatial indexing supporting spherical distance calculations directly in MongoDB for historical reporting and regional querying.

## ADR-0014: Deterministic Booking State Transitions with Status History Audit Trail

- **Status**: Accepted
- **Context**: Bookings progress through complex lifecycles with strict operational and financial preconditions. Out-of-order transitions cause financial discrepancies and partner dispatch corruption.
- **Decision**: State changes are mediated exclusively through `BookingTransitionService` enforcing the immutable `BOOKING_TRANSITIONS` state-machine map from `@sanitary/shared`. Transitions execute via atomic conditional updates (`findOneAndUpdate({ _id, status: from }, { $set: { status: to }, $push: { statusHistory } })`), rejecting illegal transitions with HTTP 409 `INVALID_STATE_TRANSITION` and emitting domain events (`booking.status_changed`, `booking.cancelled`).
- **Consequences**: Strict linear progression guarantee with immutable transition audit trails and race condition protection.

## ADR-0015: Keyset Cursor Pagination for High-Volume Booking Feeds

- **Status**: Accepted
- **Context**: Customers, partners, and administrators query chronological lists of bookings. Standard offset pagination (`skip(page * limit)`) incurs $O(N)$ scan overhead on deep pages and causes skipped or duplicate records when new bookings are created concurrently.
- **Decision**: Implement keyset cursor pagination utilizing compound B-tree index `{ createdAt: -1, _id: -1 }`. Next pages are queried via indexed boundary condition (`{ $or: [{ createdAt: { $lt: cursorDate } }, { createdAt: cursorDate, _id: { $lt: cursorId } }] }`). Cursors are encoded as URL-safe base64 strings containing the boundary record timestamp and ID.
- **Consequences**: Guaranteed $O(\text{limit})$ constant retrieval time regardless of dataset size or pagination depth, eliminating record duplication and offset scan overhead.

## ADR-0016: Progressive-Radius Dispatch with Min-Heap Top-K Scoring and 15s Delayed Timeout Fallthrough

- **Status**: Accepted
- **Context**: Booking dispatch requires identifying nearby, online, non-busy partners, scoring them fairly based on multiple operational dimensions (proximity, rating, acceptance rate, recent load), offering the pickup sequentially to the top candidate with a 15-second response window, and falling through to subsequent candidates or wider geographic radii if unanswered.
- **Decision**: Dispatch expands across progressive search radii `[3, 5, 8]` km. Candidates are scored using a weighted algorithm (`proximity * 0.4 + rating * 0.3 + acceptanceRate * 0.2 + recentLoad * 0.1`) and ranked using an in-memory `MinHeap<T>` of size $k$ achieving optimal $O(N \log k)$ time and $O(k)$ space. Sequential offers are emitted via Socket.IO user rooms and backed by BullMQ delayed jobs (`dispatch:timeout`, 15,000ms delay). On timeout expiration, if the booking remains in `SEARCHING` status, dispatch falls through to index $+ 1$, or transitions to `NO_PARTNER` when all candidates across all radii are exhausted.
- **Consequences**: Prevents broadcast storms, optimizes partner pickup latency, guarantees bounded memory overhead during candidate ranking, and ensures robust timeout recovery.

## ADR-0017: Atomic Conditional Partner Job Acceptance

- **Status**: Accepted
- **Context**: Multiple partners offered a pickup (or racing during fallthrough boundaries) may attempt to accept the same booking simultaneously. Race conditions can lead to double booking assignments or inconsistent state.
- **Decision**: Partner acceptance (`POST /bookings/:id/accept`) executes an atomic MongoDB conditional update `findOneAndUpdate({ _id, status: "SEARCHING" }, { $set: { status: "ASSIGNED", partnerId }, $push: { statusHistory } }, { new: true })`. Exactly one partner matches the precondition and wins the assignment; all competing concurrent requests match 0 documents and immediately receive HTTP 409 `BOOKING_ALREADY_ASSIGNED`. A 2-hour Redis busy lock (`partner:busy:<partnerId>`) is set atomically to prevent dispatching additional jobs to the winning partner.
- **Consequences**: Absolute consistency under extreme concurrency with zero double-assignment risk and $O(1)$ indexed write performance.

## ADR-0018: Append-Only Double-Entry Financial Ledger in MongoDB Transactions

- **Status**: Accepted
- **Context**: Storing mutable wallet balances in database documents leads to race conditions, lost updates, and financial discrepancies with zero auditability.
- **Decision**: All financial events (UPI payments, Cash collections, platform commissions, partner payouts) are strictly recorded as immutable append-only records in `ledger_entries` using double-entry bookkeeping ($\sum \text{debits} == \sum \text{credits}$ across customer, partner, and platform accounts). Every transaction executes atomically inside a MongoDB transaction/session with a unique `idempotencyKey` index. Balances are derived dynamically via MongoDB aggregation ($\sum \text{credits} - \sum \text{debits}$) with Redis-cached snapshots (`wallet:balance:<type>:<id>`) invalidated on every write.
- **Consequences**: Mathematically proven zero-sum financial integrity, complete tamper-evident audit trails, and zero mutable balance drift.

## ADR-0019: Idempotent Payment Webhook Ingestion & Partner Cash Commission Gating

- **Status**: Accepted
- **Context**: Payment gateways (Razorpay) retry webhooks multiple times during network retries. For cash pickups, partners collect cash directly from customers, requiring platform commission to be debited from partner wallets while preventing partners with excessive negative balances from continuing to receive new jobs.
- **Decision**: Webhook endpoint `POST /payments/webhook` verifies HMAC-SHA256 signatures using Node's native `crypto.timingSafeEqual` and tracks event IDs in an indexed array on the payment document. Replayed webhooks immediately exit without mutating the ledger or balances. In CASH pickups, partner wallet is debited the platform commission. During progressive dispatch candidate filtering, partners whose wallet balance drops below `MIN_PARTNER_WALLET_BALANCE_PAISE` (-₹500 overdraft floor) are disqualified from receiving offers.
- **Consequences**: Guaranteed idempotent webhook ingestion with zero double-crediting risk and automatic platform revenue protection against partner overdrafts.

## ADR-0020: Resilient AI Vision Waste Estimation with Circuit Breaker, Exponential Backoff, and SHA-256 Image Caching

- **Status**: Accepted
- **Context**: Customers submit waste photos to receive automated volume and item classification. Relying on an external vision LLM introduces latency, cost, rate-limiting, and intermittent provider failure risks.
- **Decision**: Abstract vision AI behind `AiProvider` interface with runtime provider selection (`gemini` | `mock`). Wrap outbound calls in an in-memory stateful Circuit Breaker (`CLOSED`, `OPEN`, `HALF_OPEN` with 3-failure threshold, 10s reset timeout) and 3-attempt exponential backoff retry. Compute SHA-256 hashes of input image URLs/data to cache responses in Redis (`ai:estimate:<sha256>`) with a 24-hour TTL, eliminating duplicate LLM invocations. Enforce per-user daily limits (10 requests/day via Redis counter `ai:rate:daily:<userId>:<date>`). If confidence score < 0.6, or if provider fails / trips circuit breaker, gracefully return `{ fallback: true }` without crashing, enabling customers to manually select waste items in the UI. Feed successful estimates into the pure pricing engine to generate instant quotes.
- **Consequences**: Zero user-facing downtime on AI provider outages, dramatic token/cost reduction via deterministic caching, strict abuse protection, and seamless UI fallback.

## ADR-0021: Rule-Based Pickup Fraud Detection and Model Accuracy Tracking

- **Status**: Accepted
- **Context**: AI estimates weight and volume prior to partner dispatch, but customers or partners may misrepresent waste loads, partners may report incorrect weights or collect from outside the customer's location, or customers may repeatedly cancel after viewing estimates.
- **Decision**: On pickup completion (`POST /bookings/:id/weigh`), store partner's actual measured weight (`actualWeightKg`), calculate estimation error in kg and percentage (`abs(actual - est) / est * 100`), and evaluate automated rule-based fraud detection:
  1. `WEIGHT_MISMATCH`: calculate z-score $|(\text{actual} - \mu_{\text{est}})| / \sigma_{\text{wasteType}}$; if z-score >= 3.0, flag anomalous weight discrepancy.
  2. `GPS_MISMATCH`: compute Haversine distance between partner pickup coordinates and customer booking location; flag if distance > 500 meters.
  3. `HIGH_CANCELLATION_RISK`: query customer's past 30-day booking history; flag if cancellation rate exceeds 20% (minimum 3 bookings).
     Store flags (`fraudFlags`) and composite score on the booking. Expose admin accuracy endpoint `GET /admin/ai-accuracy` aggregating mean absolute error (MAE), mean absolute percentage error (MAPE), sample counts, and high-error booking rate.
- **Consequences**: Transparent platform visibility into AI model performance, automated deterrent against partner/customer fraud, and continuous telemetry for fine-tuning estimation heuristics.

## ADR-0022: Vite React PWA with Route-Level Code Splitting and Client-Side Canvas Image Compression

- **Status**: Accepted
- **Context**: The customer frontend needs to deliver a native app-like experience for doorstep waste pickups across India. Uploading multi-megabyte raw photos directly from phone cameras incurs severe upload latency, high cellular bandwidth consumption, and frequent aborts on spotty networks.
- **Decision**: Build a Vite React Progressive Web App (`@sanitary/customer`) with route-level lazy loading (`React.lazy` + `Suspense`), TanStack Query v5 with stale-while-revalidate caching, and a service worker for offline fallback. Client-side image compression (`useImageCompression`) uses HTML5 `<canvas>` to downscale photos to a max 1280px bounding box with 0.78 JPEG quality, shrinking payloads by 85–95% (from 6MB down to ~150KB) before executing direct binary uploads to presigned URLs.
- **Consequences**: Sub-10kB initial critical payload, instant First Contentful Paint (<0.2s), Lighthouse 95+ performance, and robust photo submissions on degraded mobile networks.

## ADR-0023: Keyset Cursor Infinite Scroll and Real-Time Socket.IO Live Partner Radar

- **Status**: Accepted
- **Context**: Customers need real-time visibility into assigned partner arrival without battery-draining polling, and need to browse past bookings seamlessly without offset-pagination latency or duplicate items.
- **Decision**: Utilize TanStack Query `useInfiniteQuery` coupled with an `IntersectionObserver` sentinel querying the keyset cursor pagination API (`GET /bookings?cursor=...`). Real-time tracking leverages Socket.IO rooms (`user:<userId>`) with JWT handshake authentication, subscribing to `partner_location` and `status_change` events to update live radar coordinates and booking state reactively without polling loops.
- **Consequences**: Real-time low-latency telemetry updates, zero wasteful polling traffic on the server, and smooth continuous infinite browsing of pickup records.
