# Backend Security & Architecture Migration Plan

## Objective

Transform the current Expo + Supabase Edge Functions architecture into a production-grade system with a containerized Express API, server-managed authentication sessions, hardened security boundaries, and optimized data flow suitable for health-related applications.

This plan supersedes all previous backend assumptions.

---

## Architectural Principles

- The backend API is the sole trusted execution boundary
- Clients are treated as untrusted
- Authentication state is validated server-side on every request
- No direct client → database access
- No long-lived client tokens
- Explicit separation between mobile, backend, and shared code

---

## Phase 1 — Repository Hardening

### Tasks

- Enforce monorepo boundaries:
  - `apps/mobile` → client-only
  - `services/api` → backend-only
  - `packages/shared` → pure, side-effect-free code
- Eliminate ambiguous root-level folders (`constants`, `types`)
- Ensure backend code is never imported by mobile code
- Apply senior-grade `.gitignore`

### Definition of Done

- Clean repo boundaries
- No cross-import violations
- No secrets or build artifacts tracked

---

## Phase 2 — Backend API Foundation

### Tasks

- Implement Express server under `services/api`
- Bind server to `0.0.0.0`
- Centralize configuration management
- Implement health check endpoint
- Add structured logging (no PII, no tokens)

### Constraints

- Backend must be independently deployable
- No dependency on Expo tooling

---

## Phase 3 — Authentication Migration (CRITICAL)

### Tasks

- Remove all client-side JWT persistence
- Migrate authentication to Supabase-managed sessions
- Validate auth state server-side on every request
- Implement authentication middleware
- Enforce least-privilege Supabase access using service role key

### Non-Goals

- No JWT verification in the client
- No token storage in AsyncStorage or localStorage

---

## Phase 4 — Security Hardening

### Tasks

- Implement rate limiting on all public endpoints
- Apply stricter limits to auth-related routes
- Validate all incoming payloads using schema validation
- Centralize error handling
- Normalize API responses
- Prevent internal error leakage

### Threats Addressed

- Brute force attacks
- Token replay
- Enumeration attacks
- Over-fetching
- Business logic abuse

---

## Phase 5 — Data Flow Optimization

### Tasks

- Move all Supabase queries to the backend
- Aggregate queries server-side
- Introduce DTO-based response contracts
- Reduce chatty request patterns
- Cache non-user-specific data where appropriate

---

## Phase 6 — Dockerization & Deployment

### Tasks

- Create production-grade Dockerfile
- Enforce deterministic dependency installation
- Inject configuration via environment variables
- Validate container startup and shutdown behavior
- Prepare backend for container-based deployment platforms

### Constraints

- No secrets baked into images
- No orchestration required at this stage

---

## Phase 7 — Supabase Edge Function Decommissioning

### Tasks

- Freeze existing Edge Functions
- Re-implement critical logic in Express
- Validate behavioral parity
- Remove Edge Functions after successful migration

---

## Deliverables

- Containerized Express API
- Server-side session-based authentication
- Rate-limited, validated endpoints
- Centralized business logic
- Hardened repository structure
- Production-ready deployment configuration

---

## Definition of Done

- Client never accesses Supabase directly
- All auth is server-validated
- API rejects abusive or malformed requests
- Backend is deployable, auditable, and isolated
- Architecture meets security expectations for health applications

---

## Priority

BLOCKER — must be completed before feature expansion

---

## Notes for Agent

Assume adversarial clients.
Favor correctness over convenience.
Security decisions must be explicit.
Avoid premature optimization.
