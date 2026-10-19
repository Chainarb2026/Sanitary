# Project State

## Phase 0: Scaffold + Shared Package

### Done

- Scaffolded monorepo with NPM workspaces (`apps/*`, `packages/*`), root `tsconfig.base.json`, Prettier, ESLint flat config, and Vitest.
- Created `@sanitary/shared` (money utilities, booking state machine, shared types, and Zod schemas).
- Created `docker-compose.yml` for single-node MongoDB replica set (`rs0`) with automated initiation and Redis 7.
- Created `apps/api` infra modules (config loader, logger, db, redis, queue, socket, error middleware, health/ready endpoints).

## Phase 1: Authentication & Authorization

### Done

- Created Mongoose `User` model with unique index on `phone` and timestamping, adhering to data rules.
- Implemented `UserRepo` (with `.lean()` queries) and `UserService` in `modules/users`.
- Implemented `SmsProvider` interface and `DevSmsProvider` logging OTPs to console/Pino in development.
- Built `OtpStore` in Redis storing HMAC-SHA256 hashed OTPs with 5-minute TTL, constant-time verification, and 3-attempt lockout.
- Built native `jwt.ts` utility providing HS256 JWT signing and verification with zero unapproved dependencies.
- Implemented rotating refresh tokens with family tracking and automatic reuse detection in `RefreshTokenStore` via Redis.
- Implemented `createRateLimiter` Express middleware using Redis token-bucket via atomic Lua script.
- Built `AuthService`, `AuthController`, and `authRouter` with endpoints (`POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`).
- Implemented `authenticate` and `requireRole('customer' | 'partner' | 'admin')` RBAC middlewares.

## Phase 2: Catalog + Pricing

### Done

- Implemented pure pricing function in `@sanitary/shared/src/pricing.ts` computing `{base, perKg, convenienceFee, surgeMultiplier, total, partnerEarning, platformCommission}` in integer paise.
- Built feature-flagged surge pricing (`flags.enableSurge`), defaulting to 1.0x (OFF) and clamped to a 1.5x hard ceiling.
- Supported per-waste-type configurable commission rates with zero rounding loss.
- Created Mongoose `WasteType` model with unique `slug` index and compound index on `{ isActive: 1, createdAt: -1 }`.
- Seeded default catalog with all 7 requested waste types: small bag, medium, bulk furniture, debris, garden waste, e-waste, scrap.
- Implemented `WasteTypeRepo` with lean queries and `WasteTypeService` with Redis cache-aside (1-hour TTL) and write invalidation.
- Built admin-only CRUD endpoints (`POST /waste-types`, `PUT /waste-types/:id`, `DELETE /waste-types/:id`, `GET /waste-types/admin/all`) guarded by `requireRole('admin')`.
- Built client-facing catalog retrieval (`GET /waste-types`) and quote estimation endpoint (`POST /waste-types/quote`).
- Implemented property-based test suite running 500 stochastic permutations proving `partnerEarning + platformCommission + convenienceFee == total` with zero rounding loss.
- Implemented integration test suite verifying catalog seeding, admin RBAC guards, Redis cache-aside reads, and invalidation on write.

## Phase 3: Partners + Location Tracking

### Done

- Created Mongoose `Partner` model (`userId`, `phone`, `name`, `vehicleType`, `serviceRadiusKm`, `isOnline`, `isActive`, `kyc` metadata) with compound indexes on `{ isOnline: 1, isActive: 1 }` and `{ "kyc.status": 1 }`.
- Implemented partner onboarding (`POST /partners/onboard`) with document metadata (`driving_license`, `aadhaar`, `voter_id`, `pan`, `passport`), document number, and storage URL.
- Built administrative KYC review endpoints (`POST /partners/:id/approve`, `POST /partners/:id/reject`) restricted to `admin` role.
- Enforced strict online/offline gating (`POST /partners/status`): partners can only go online if KYC status is `APPROVED`. Going offline immediately purges the partner from Redis GEO.
- Implemented high-throughput location ping endpoint (`POST /partners/location`) and real-time Socket.IO handler (`location:ping`) writing directly to Redis GEO (`partners:geo`) with 30-second expiring presence keys (`partner:presence:<partnerId>`).
- Implemented server-side ping throttling (minimum 3s interval per partner) using atomic Redis key acquisition (`partner:throttle:<partnerId>`).
- Implemented pure geospatial retrieval function `findNearby(lat, lng, radiusKm, limit)` querying Redis GEO, validating active presence, lazily evicting stale expired partners, and returning nearby active partners sorted ascending by distance (`GET /partners/nearby`).
- Created Mongoose `Address` model for customers with GeoJSON `Point` (`coordinates: [lng, lat]`), `2dsphere` index, optional `buildingId`, label taxonomy (`home`, `work`, `other`), and single-default toggle.
- Created Mongoose `Building` model with GeoJSON `Point` coordinates and `2dsphere` index for gated societies / apartments.
- Built address management endpoints (`POST /addresses`, `GET /addresses`, `DELETE /addresses/:id`).
- Implemented comprehensive Phase 3 integration test suite verifying onboarding, admin KYC approve/reject, online/offline gating, location pings, 30s presence, ping throttling, and address GeoJSON persistence.
- Implemented Redis GEO benchmark test seeding 10,000 live partners across Bengaluru and verifying `findNearby` query latency (<2ms).

## Phase 4: Bookings Management

### Done

- Created Mongoose `Booking` model (`customerId`, `partnerId`, `items`, `address` snapshot, `slot`, `quote`, `status`, `statusHistory`, `pickupOtpHashed`, `idempotencyKey`).
- Added optimized compound and partial indexes: `{ customerId: 1, createdAt: -1 }`, `{ partnerId: 1, status: 1, createdAt: -1 }`, unique `{ customerId: 1, idempotencyKey: 1 }` with partial filter for non-null strings, and partial `2dsphere` on `address.location` for active statuses (`CREATED`, `SEARCHING`, `ASSIGNED`, `EN_ROUTE`, `ARRIVED`).
- Implemented `BookingRepo` with atomic conditional state updates (`findOneAndUpdate` with status precondition) and keyset cursor pagination (`encodeCursor`, `decodeCursor`).
- Built strongly-typed domain event emitter `bookingEvents` emitting `booking.created`, `booking.status_changed`, and `booking.cancelled`.
- Implemented pickup OTP workflow: 6-digit cryptographically random code, HMAC-SHA256 hashed in MongoDB, stored in Redis for customer retrieval, redacted from partner views, physically verified upon arrival.
- Implemented `BookingTransitionService` enforcing transitions strictly through the shared `@sanitary/shared` state machine map and appending immutable audit history entries.
- Implemented customer cancellation workflow with fee assessment rules (0 fee before dispatch, 5000 paise after partner assignment, blocked after `OTP_VERIFIED`).
- Implemented `BookingService` with idempotency key deduplication (duplicate header returns original booking with `X-Idempotent-Replay: true`).
- Built customer, partner, and admin keyset-paginated listing endpoints (`GET /bookings`, `GET /bookings/partner`, `GET /bookings/admin`).
- Implemented integration test suite covering creation, idempotency replay, illegal state transition rejection, partner OTP verification, customer cancellation fee rules, and zero-overlap multi-page keyset pagination traversals.

## Phase 5: Dispatch Engine & Realtime

### Done

- Implemented generic, strongly typed `MinHeap<T>` in `@sanitary/shared/src/minHeap.ts` with complete heap operations (`siftUp`, `siftDown`, `push`, `pop`, `peek`, `toDescendingArray`). Verified via property tests.
- Added performance and scoring metadata fields (`rating`, `acceptanceRate`, `recentLoad`) to `Partner` schema in `modules/partners/model.ts` and added batch profile hydration helper `partnerService.findByIds()`.
- Implemented weighted scoring engine in `modules/dispatch/scorer.ts` (`proximity * 0.4 + rating * 0.3 + acceptanceRate * 0.2 + recentLoad * 0.1`) and top-$k$ candidate selection using size-$k$ Min-Heap in $O(N \log k)$ time and $O(k)$ space.
- Built BullMQ dispatch queue with job types `dispatch:start` and `dispatch:timeout` in `modules/dispatch/queue.ts`, registered dispatch worker in `worker.ts`, and implemented processor in `modules/dispatch/processor.ts`.
- Implemented `DispatchService` in `modules/dispatch/service.ts`:
  - Progressive-radius partner search across `[3, 5, 8]` km via Redis GEO `findNearby()`.
  - Filter for online and non-busy partners (both Redis `partner:busy:<partnerId>` and MongoDB active bookings).
  - Progressive offer dispatch: sequential offers with 15-second delayed BullMQ timeout jobs.
  - Automatic fallthrough to candidate $+ 1$ upon 15s timeout if booking remains `SEARCHING`.
  - Graceful `NO_PARTNER` transition and customer notification when all candidates across all radii are exhausted.
  - Atomic acceptance (`POST /bookings/:id/accept`) using `findOneAndUpdate({ _id, status: "SEARCHING" })` with 2-hour Redis busy lock and status history audit entry.
- Subscribed `bookingEvents.on("booking.created")` in `modules/dispatch/listener.ts` to trigger asynchronous dispatch workflows immediately upon booking creation.
- Enhanced real-time Socket.IO module (`infra/socket.ts`) with handshake token authentication, per-user room routing (`user:<userId>`), and strongly typed helper methods for `offer`, `assigned`, `status_change`, and `partner_location` backed by `@socket.io/redis-adapter`.
- Created Phase 5 test suite in `apps/api/tests/dispatch.test.ts`:
  - Verified weighted scoring and size-$k$ min-heap ranking.
  - Concurrency test with 20 partners accepting simultaneously where EXACTLY ONE wins (HTTP 200) and 19 receive HTTP 409 `BOOKING_ALREADY_ASSIGNED`.
  - Verified 15s offer timeout fallthrough to candidate 2.
  - Verified `NO_PARTNER` exhaustion resolution when no partners are available or all time out.

## Phase 6: Payments, Double-Entry Ledger & Settlement

### Done

- Created Mongoose `LedgerEntry` model (`transactionId`, `accountType: customer | partner | platform`, `accountId`, `type: debit | credit`, `amountPaise`, `idempotencyKey`, `description`, `metadata`) with compound index `{ accountType: 1, accountId: 1, createdAt: -1 }`.
- Implemented `LedgerService` with strict double-entry balance validation ($\sum \text{debits} === \sum \text{credits}$), idempotent transaction execution inside MongoDB transactions/sessions, and wallet balance aggregation ($\sum \text{credits} - \sum \text{debits}$) backed by 5-minute Redis snapshot cache (`wallet:balance:<type>:<id>`).
- Defined `PaymentProvider` interface and native `RazorpayPaymentProvider` implementing dynamic UPI link/QR generation and cryptographic HMAC-SHA256 signature verification (`crypto.timingSafeEqual`).
- Created Mongoose `Payment` model and implemented `PaymentService`:
  - `initiateUpiPayment`: creates dynamic payment link/QR and tracks pending payments.
  - `processCashPayment`: partner collects cash in person, platform commission is debited from partner wallet via double-entry ledger transaction (`debit partner`, `credit platform`), transitions booking to `PAID`.
  - `handleWebhook`: verifies signature, idempotently processes `payment.captured` webhooks, posts balanced 3-leg ledger entries (`debit customer`, `credit partner`, `credit platform`), transitions booking to `PAID`, and prevents duplicate balance mutations upon replays.
- Integrated minimum wallet balance gating in `dispatchService.findProgressiveCandidates`: partners whose wallet balance drops below `MIN_PARTNER_WALLET_BALANCE_PAISE` (-₹500 floor) are blocked from receiving new dispatch offers.
- Created `Payout` model and `PayoutService`:
  - Partner requests wallet payout (`POST /payouts/request`), verified against available balance.
  - Enqueues BullMQ settlement job on `"settlement"` queue.
  - BullMQ settlement processor executes double-entry disbursement ledger transaction (`debit partner`, `credit platform`) and marks payout `PROCESSED`.
- Built user wallet balance query endpoint (`GET /wallet/balance`).
- Created comprehensive Phase 6 test suite in `apps/api/tests/payments.test.ts`:
  - Property test: 50 stochastic multi-leg transactions proving the ledger globally and per-transaction always balances to zero, and rejecting imbalanced attempts.
  - Webhook idempotency test: replaying identical webhook 5 times succeeds and changes partner/customer/platform balances exactly ONCE with zero duplicate ledger rows.
  - Cash payment and wallet minimum threshold test: verifies platform fee deduction and blocking of offers when wallet drops below threshold.
  - Partner payout request, settlement job execution, and overdraft rejection tests.

## Phase 7: AI Vision Estimation & Pickup Fraud Detection

### Done

- Defined `AiProvider` interface with runtime selection (`gemini` | `mock`) via `AI_PROVIDER` env variable.
- Implemented stateful `CircuitBreaker` (`CLOSED`, `OPEN`, `HALF_OPEN` states with 3-failure threshold, 10s cooldown window, and exponential backoff retry).
- Built `GeminiVisionAiProvider` with 15-second AbortController timeout, token/cost estimation logging, and strict Zod validation.
- Implemented `AiService` in `modules/ai/service.ts`:
  - Input image URL SHA-256 hash caching in Redis (`ai:estimate:<sha256>`) with a 24-hour TTL to eliminate redundant LLM calls.
  - Per-user daily request rate limiting (`ai:rate:daily:<userId>:<date>`, limit 10/day).
  - Resilient fallback handling: confidence < 0.6 or provider failure/circuit breaker returns `{ fallback: true }` allowing users to proceed with manual item selection.
  - Integration with the pure pricing engine `price()` in `@sanitary/shared` to calculate an instant quote based on estimated weight, volume class, and items.
- Built pickup weight verification and fraud detection engine in `modules/ai/accuracyService.ts`:
  - Partners record actual physical weight upon pickup (`POST /bookings/:id/weigh`).
  - Computes absolute error in kg and percentage error (`abs(actual - est) / est * 100`).
  - Evaluates rule-based fraud flags:
    1. `WEIGHT_MISMATCH`: Z-score of actual vs estimated weight $\ge 3.0$ against waste type standard deviations.
    2. `GPS_MISMATCH`: Haversine distance between partner pickup coordinates and customer pickup location $> 500\text{m}$.
    3. `HIGH_CANCELLATION_RISK`: Customer past 30-day cancellation rate $> 20\%$ with $\ge 3$ bookings.
  - Stores `fraudFlags` and composite `fraudScore` directly on the booking.
  - Exposes administrative accuracy telemetry endpoint (`GET /admin/ai-accuracy`) aggregating total weighed bookings, MAE, MAPE, and high-error booking percentages.
- Created and passed test suite `apps/api/tests/ai.test.ts` covering:
  - Cache-hit return path bypassing provider calls.
  - Low-confidence (< 0.6) payload returning `{ fallback: true }`.
  - Malformed/invalid JSON schema response from provider falling back gracefully.
  - Provider timeout and circuit breaker trip returning `{ fallback: true }`.
  - Instant quote calculation, actual weight recording, fraud flag evaluation (weight mismatch, GPS mismatch, cancellation risk), and admin accuracy metric reporting.
- All 16 test files (74 tests) passing with zero lint warnings, formatting errors, or typecheck issues.

## Phase 8A: Shared + Customer App (Vite React PWA)

### Done

- Created mobile-first, responsive Progressive Web App `@sanitary/customer` with Vite, React, and Vanilla CSS design tokens.
- Implemented route-level code splitting using `React.lazy` and `Suspense` with skeleton loading states, keeping critical initial gzipped CSS under 2.1 kB and total critical payload under 10 kB for Lighthouse 95+ performance.
- Built PWA capabilities: `manifest.json`, SVG icon, and Service Worker (`sw.js`) with stale-while-revalidate offline caching strategy.
- Implemented `useImageCompression` hook utilizing HTML5 `<canvas>` to compress raw camera photos (downscaling to max 1280px at 0.78 JPEG quality), shrinking payloads by 85–95% on-device prior to upload.
- Implemented direct presigned upload support (`POST /uploads/presign` and `PUT /uploads/files/:key`) in `apps/api` allowing fast direct binary uploads.
- Built full multi-step booking flow in `BookingFlowPage`:
  - AI Waste Scanner: photo capture, direct presigned upload, animated scanning beam, Gemini AI item/volume/hazard detection, and seamless manual category fallback on low confidence (<0.6).
  - Address Picker: interactive Bengaluru neighborhood hubs (Indiranagar, Koramangala, HSR Layout, Whitefield, Jayanagar), live GPS geolocation (`navigator.geolocation`), and saved addresses list.
  - Slot Picker: ASAP pickup (15-30m) vs scheduled slot selector with custom partner notes.
  - Transparent fare breakdown card with base, per-kg, convenience fee, surge status, and partner compensation guarantee.
  - Payment Screen: dynamic UPI QR generation, UPI app deep links (`upi://pay`), cash-on-pickup selection, and simulated gateway confirmation.
- Built real-time live partner tracking in `TrackingPage`:
  - Socket.IO connection with JWT handshake authentication to room `user:<userId>`.
  - Reactive listening for `partner_location` and `status_change` events to update live map radar without battery-draining polling loops.
  - Bold 6-digit customer pickup OTP display ("Share with partner upon physical arrival").
  - Customer cancellation action with fee rules modal (free while searching, ₹50 when assigned, blocked after arrival/OTP).
- Built booking history in `HistoryPage` with TanStack Query `useInfiniteQuery` and `IntersectionObserver` cursor pagination infinite scroll.
- Created tests covering direct uploads, token storage, and aspect-ratio image compression math. All 19 test files (80 tests) passing across the repository.

### Next

- **PHASE 8B**: Partner App (online/offline toggle, offer card with 15s countdown, job steps with OTP verification, physical scale weighing, cash collection, earnings & wallet).

### Decisions

- Standardized money storage and computation strictly on integer paise (ADR-0002).
- Enforced booking state transitions via immutable state machine transition dictionary (ADR-0003).
- Structured API response errors into uniform `{ error: { code, message, details? } }` shape (ADR-0004).
- Single-node MongoDB replica set configured in docker-compose for multi-document transaction support (ADR-0006).
- HMAC-SHA256 hashed OTP storage in Redis with 5-min TTL and attempt limit lockouts (ADR-0007).
- Refresh token family rotation with automatic reuse detection and full family revocation (ADR-0008).
- Atomic Redis token-bucket rate limiting via Lua script (ADR-0009).
- Pure pricing engine with exact invariant balance and surge clamping (ADR-0010).
- Cache-aside pattern with write invalidation for waste catalog in Redis (ADR-0011).
- Redis GEO for live partner locations with 30-second presence expiration and server-side ping throttling (ADR-0012).
- GeoJSON Point and 2dsphere indexing in MongoDB for customer pickup addresses (ADR-0013).
- Deterministic booking state transitions with status history audit trail (ADR-0014).
- Keyset cursor pagination with compound index B-tree range scans for booking lists (ADR-0015).
- Progressive-radius dispatch with Min-Heap top-$k$ scoring and 15s delayed timeout fallthrough (ADR-0016).
- Atomic conditional partner job acceptance with `SEARCHING` precondition and Redis busy locking (ADR-0017).
- Append-only double-entry financial ledger in MongoDB transactions (ADR-0018).
- Idempotent payment webhook ingestion & partner cash commission gating (ADR-0019).
- Resilient AI vision waste estimation with circuit breaker, exponential backoff, and SHA-256 image caching (ADR-0020).
- Rule-based pickup fraud detection and model accuracy tracking (ADR-0021).
- Vite React PWA with route-level code splitting and client-side canvas image compression (ADR-0022).
- Keyset cursor infinite scroll and real-time Socket.IO live partner radar (ADR-0023).

### Known Gaps

- Operations dashboard and analytics rollups in subsequent operational phases will consume ledger records for platform financial reporting.
