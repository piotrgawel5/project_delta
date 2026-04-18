# services/api/CLAUDE.md

Express.js API service for Project Delta. Node 20, TypeScript, Zod validation, Supabase PostgreSQL.

## Directory Structure

```
src/
  index.ts                      → Server entry (Express app, middleware stack, routing)
  config/
    index.ts                    → Environment config (RP_ID, RP_NAME, RP_ORIGIN, SUPABASE_URL...)
  middleware/
    authorization.ts            → JWT verification, sets req.user
    errorHandler.ts             → Global error handler (catches AppError + unknown)
    rateLimiter.ts              → 100 req/15min global; 5/hour auth routes
    requestId.ts                → X-Request-ID header injection
    requestLogger.ts            → Structured request logging
    validate.ts                 → Zod schema validation (req.body + params + query)
  modules/
    auth/
      auth.routes.ts            → Passkey registration/login endpoints
      auth.controller.ts        → Auth request handlers
      auth.service.ts           → WebAuthn logic (@simplewebauthn/server)
      auth.validation.ts        → Auth Zod schemas
      auth.middleware.ts        → authenticate middleware
    sleep/
      sleep.routes.ts           → Sleep sync, edit, timeline endpoints
      sleep.controller.ts       → Sleep request handlers
      sleep.service.ts          → Sleep business logic
      sleep.validation.ts       → Sleep Zod schemas
    profile/
      profile.routes.ts         → Profile endpoints
      profile.controller.ts     → Profile request handlers
      profile.service.ts        → Profile business logic
      profile.validation.ts     → Profile Zod schemas
  routes/
    health.ts                   → GET /health (Docker health check)
  utils/
    AppError.ts                 → Typed error class (message + statusCode)
    asyncHandler.ts             → Wraps async handlers to forward errors
    logger.ts                   → Structured logger

dist/                           → Compiled output (gitignored)
Dockerfile                      → Multi-stage Node 20 Alpine build
```

## Middleware Stack Order

```ts
helmet()                  // Security headers
cors()                    // CORS (configured origins)
cookie-parser()           // Cookie parsing
rateLimiter (global)      // 100 req/15min
requestId()               // X-Request-ID
requestLogger()           // Structured logs
// Routes mount here
errorHandler()            // Must be last
```

## Route Handler Pattern

```ts
// routes.ts
router.post('/', authenticate, validate(Schema), asyncHandler(controller.method));

// controller.ts — thin, no business logic
export const controller = {
  method: async (req: Request, res: Response) => {
    const result = await service.doThing(req.body, req.user!.id);
    res.status(201).json({ data: result });
  },
};

// service.ts — pure business logic, injectable
export async function doThing(input: InputType, userId: string): Promise<ResultType> {
  // Supabase queries here
}
```

## Response Shape

```ts
// Success
res.json({ data: T });
res.status(201).json({ data: T });

// Error — use AppError
throw new AppError('Not found', 404);

// Never mixed shapes like { success: boolean, result: T }
```

## Key Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | None | Docker health check |
| POST | /api/auth/register/options | None | Passkey registration options |
| POST | /api/auth/register/verify | None | Passkey registration verify |
| POST | /api/auth/login/options | None | Passkey login options |
| POST | /api/auth/login/verify | None | Passkey login verify |
| POST | /api/sleep/sync-batch | JWT | Offline batch sync |
| GET | /api/sleep/:userId/timeline/:date | JWT | Phase timeline for hypnogram |
| GET | /api/profile | JWT | Get user profile |
| PATCH | /api/profile | JWT | Update profile |

## Non-Negotiable Rules

- `authenticate` middleware on every non-public route
- `validate(Schema)` before any use of `req.body`, `req.params`, `req.query`
- `asyncHandler` wrapping on all async handlers (catches unhandled rejections)
- No raw SQL string interpolation — Supabase client `.eq()` / `.filter()` only
- No secrets in source — read from `config/index.ts` which reads `process.env`
- Supabase queries use service role key (bypasses RLS — handle ownership in WHERE clauses)

## Validation Commands

```bash
cd services/api

npm run dev           # Start dev server with ts-node
npm run build         # Compile TypeScript → dist/

# From repo root:
npx tsc --noEmit -p services/api/tsconfig.json   # Type check
```
