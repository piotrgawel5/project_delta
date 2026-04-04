# Project Delta API

Production-grade Express.js API server for the Project Delta mobile application.

## Features

- **Authentication**: Email/password, Google OAuth, and WebAuthn passkey authentication
- **Sleep Tracking**: CRUD operations for sleep logs and history
- **User Profiles**: Profile management with avatar upload support
- **Security**: Helmet, CORS, rate limiting, request ID tracking
- **Error Handling**: Structured error responses with request tracing
- **Validation**: Zod schema validation for all endpoints
- **Logging**: Structured JSON logging for production monitoring

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase project with Auth enabled

### Installation

```bash
cd services/api
npm install
```

### Configuration

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Fill in your Supabase credentials:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (for admin operations)
- `SUPABASE_ANON_KEY`: Anon/public key
- `CORS_ORIGIN` (or `CORS_ORIGINS`): Comma-separated allowed origins in production

### Development

```bash
npm run dev
```

The server will start at `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t project-delta-api .
docker run -p 3000:3000 --env-file .env project-delta-api
```

## API Endpoints

### Health Check

| Method | Endpoint  | Description          |
| ------ | --------- | -------------------- |
| GET    | `/health` | Server health status |

### Authentication

| Method | Endpoint                         | Description                      |
| ------ | -------------------------------- | -------------------------------- |
| POST   | `/auth/passkey/register/options` | Get passkey registration options |
| POST   | `/auth/passkey/register/verify`  | Verify passkey registration      |
| POST   | `/auth/passkey/login/options`    | Get passkey login options        |
| POST   | `/auth/passkey/login/verify`     | Verify passkey login             |
| POST   | `/auth/email/login`              | Email/password login             |
| POST   | `/auth/email/signup`             | Email/password signup            |
| POST   | `/auth/google/login`             | Google OAuth login               |
| GET    | `/auth/me`                       | Get current user                 |
| POST   | `/auth/logout`                   | Logout                           |

### Sleep

| Method | Endpoint                     | Description           |
| ------ | ---------------------------- | --------------------- |
| GET    | `/api/sleep/:userId/history` | Get sleep history     |
| GET    | `/api/sleep/:userId/:date`   | Get sleep log by date |
| POST   | `/api/sleep/log`             | Save sleep log        |
| DELETE | `/api/sleep/:userId/:date`   | Delete sleep log      |

### Profile

| Method | Endpoint                      | Description         |
| ------ | ----------------------------- | ------------------- |
| GET    | `/api/profile/:userId`        | Get user profile    |
| POST   | `/api/profile/:userId`        | Update user profile |
| PUT    | `/api/profile/:userId`        | Update user profile |
| POST   | `/api/profile/:userId/avatar` | Upload avatar       |
| DELETE | `/api/profile/:userId/avatar` | Delete avatar       |

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "requestId": "uuid-for-tracing"
}
```

## Security

- **Helmet**: HTTP security headers
- **CORS**: Configured for mobile app access
- **Rate Limiting**: Prevents abuse (100 req/15min global, 5/hour for auth)
- **JWT Validation**: All protected routes validate Supabase JWT tokens
- **Request IDs**: Every request gets a unique ID for tracing

## Project Structure

```
src/
├── config/         # Configuration and environment validation
├── middleware/     # Express middleware (auth, rate limiting, logging)
├── modules/        # Feature modules
│   ├── auth/       # Authentication (passkey, email, OAuth)
│   ├── profile/    # User profile management
│   └── sleep/      # Sleep tracking
├── routes/         # Route definitions
├── utils/          # Utilities (logger, error classes)
└── index.ts        # Application entry point
```

## License

Private - All rights reserved
