# API Configuration & Utils Documentation

This document describes the configuration system and utility functions used in the `project_delta` API.

## Configuration

The API uses a centralized configuration object located in `src/config/index.ts`. It environment variables using `dotenv`.

### Environment Variables

- `SUPABASE_URL`: The URL of your Supabase project.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations (bypass RLS).
- `SUPABASE_ANON_KEY`: Anonymous key for client-side operations.
- `PASSKEY_RP_ID`: Relying Party ID for WebAuthn (usually the domain).
- `PASSKEY_RP_NAME`: Display name for the application in passkey prompts.
- `PORT`: The port the API server runs on (default: 3000).

---

## Utility Functions

### `AppError`

- **File**: `utils/AppError.ts`
- **Description**: A custom error class that extends the native `Error` class. It includes a `statusCode`, an error `code`, and an `isOperational` flag.
- **Static methods**:
  - `badRequest(message, code)`
  - `unauthorized(message, code)`
  - `forbidden(message, code)`
  - `notFound(message, code)`
  - `conflict(message, code)`
  - `tooManyRequests(message, code)`
  - `internal(message, code)`

### `logger`

- **File**: `utils/logger.ts`
- **Description**: A simple structured logger that outputs JSON strings to the console. Supports `info`, `warn`, and `error` levels.

### `asyncHandler`

- **File**: `utils/asyncHandler.ts`
- **Description**: A higher-order function that wraps asynchronous Express route handlers. It automatically catches errors and passes them to the next middleware (triggering the global error handler).
