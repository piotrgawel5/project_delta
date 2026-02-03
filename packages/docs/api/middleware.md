# API Middleware Documentation

This document describes the middleware used in the `project_delta` API to handle cross-cutting concerns.

## Authentication & Authorization

### `requireOwnership`

- **File**: `authorization.ts`
- **Description**: Ensures the authenticated user can only access their own resources. It checks if the `:userId` parameter (or `user_id` in the body) matches the authenticated user's ID (`req.user.id`).
- **Applied to**: Sensitive routes like fetching profiles or sleep logs.

### `requireAdmin`

- **File**: `authorization.ts`
- **Description**: Placeholder for checking if a user has admin privileges. Currently returns a `403 Forbidden` error.

---

## Rate Limiting

The API uses `express-rate-limit` to prevent abuse and brute-force attacks.

### Limiter Types

- **`globalLimiter`**: Applies to all routes. 100 requests per 15 minutes per IP.
- **`authLimiter`**: Stricter limits for authentication endpoints. 10 requests per hour per IP.
- **`userWriteLimiter`**: Limits data modifications. 30 write operations per 15 minutes per user.
- **`userReadLimiter`**: Limits data reads. 100 read operations per 15 minutes per user.
- **`sensitiveOpLimiter`**: Limits sensitive operations (e.g., password reset). 5 requests per hour per user.
- **`burstLimiter`**: Prevents rapid-fire requests. 10 requests per 10 seconds per user.

---

## Error & Request Handling

### `errorHandler`

- **File**: `errorHandler.ts`
- **Description**: Global error handling middleware. Logs the error using the logger and returns a standardized JSON response based on the error type (`AppError`, `ZodError`, etc.).

### `notFoundHandler`

- **File**: `errorHandler.ts`
- **Description**: Handles `404` errors for routes that do not exist.

### `validate`

- **File**: `validate.ts`
- **Description**: A wrapper for Zod validation. It validates the request body, query parameters, or URL parameters against a provided schema.

### `requestIdMiddleware`

- **File**: `requestId.ts`
- **Description**: Attaches a unique `requestId` to each request (`req.requestId`) and adds it to the response headers (`X-Request-ID`). This is used for tracing logs.

### `requestLogger`

- **File**: `requestLogger.ts`
- **Description**: Logs incoming requests (method, path, IP) and outgoing responses (status code, duration).
