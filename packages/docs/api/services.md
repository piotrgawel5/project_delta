# API Services Documentation

This document describes the core services and controllers of the `project_delta` API.

## Auth Service

The `AuthService` handles authentication logic, including passkeys (WebAuthn), email/password login, and Google Sign-in.

### Functions

- `getRegistrationOptions(email)`: Generates WebAuthn registration options and a challenge.
- `verifyRegistration(email, credential)`: Verifies the passkey registration and creates a Supabase user if it doesn't exist.
- `getLoginOptions()`: Generates WebAuthn login options.
- `verifyLogin(credential, challengeId)`: Verifies the passkey login and creates a session.
- `signInWithPassword(email, password)`: Standard Supabase email/password login.
- `signUpWithPassword(email, password)`: Standard Supabase email/password signup.
- `signInWithIdToken(token)`: Google Sign-in using an ID token.
- `signOut(token)`: Signs out the user by invalidating the session.

### Auth Controller (Endpoints)

- `POST /auth/register/options`: Initiates passkey registration.
- `POST /auth/register/verify`: Completes passkey registration.
- `POST /auth/login/options`: Initiates passkey login.
- `POST /auth/login/verify`: Completes passkey login.
- `POST /auth/login/email`: Email/password login.
- `POST /auth/signup/email`: Email/password signup.
- `POST /auth/login/google`: Google login.
- `POST /auth/logout`: Clears auth cookies.
- `GET /auth/me`: Returns current user session info.

---

## Profile Service

The `ProfileService` manages user profile data and avatar uploads.

### Functions

- `getProfile(userId)`: Fetches the user's profile from the `user_profiles` table.
- `updateProfile(userId, updates)`: Updates or creates (upserts) a user profile.
- `uploadAvatar(userId, imageBuffer, mimeType)`: Uploads an avatar to Supabase storage and updates the profile.
- `deleteAvatar(userId)`: Deletes all avatars in the user's storage folder and clears the profile's `avatar_url`.

### Profile Controller (Endpoints)

- `GET /profiles/:userId`: Retrieves profile data (requires authorization).
- `PUT /profiles/:userId`: Updates profile data.
- `POST /profiles/:userId/avatar`: Uploads a base64 encoded avatar.
- `DELETE /profiles/:userId/avatar`: Deletes the current avatar.

---

## Sleep Service

The `SleepService` handles sleep data logging and history.

### Functions

- `getHistory(userId, limit)`: Fetches the user's sleep history records.
- `saveLog(sleepLog)`: Upserts a sleep log entry (keyed by `user_id` and `date`).
- `getLogByDate(userId, date)`: Fetches a single sleep log for a specific date.
- `deleteLog(userId, date)`: Deletes a sleep log for a specific date.

### Sleep Controller (Endpoints)

- `GET /sleep/:userId/history`: Retrieves sleep history logs.
- `POST /sleep/log`: Saves a new or updated sleep log.
- `GET /sleep/:userId/log/:date`: Retrieves a specific sleep log.
- `DELETE /sleep/:userId/log/:date`: Deletes a sleep log.
