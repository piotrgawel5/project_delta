# /endpoint $ARGUMENTS

Scaffold a new Express API endpoint for Project Delta:

**$ARGUMENTS**

## Before Creating Anything

1. Read `services/api/CLAUDE.md` for module structure and conventions
2. Read `services/api/src/middleware/` for auth, validation, and rate-limit patterns
3. Confirm the module it belongs to (`auth`, `sleep`, `profile`, or new)

## File Structure (feature module pattern)

```
services/api/src/modules/<feature>/
  <feature>.routes.ts       → Express router, applies middleware
  <feature>.controller.ts   → Request/response handling (thin)
  <feature>.service.ts      → Business logic (pure, testable)
  <feature>.validation.ts   → Zod schemas for request bodies/params
```

## Route Template

```ts
// <feature>.routes.ts
import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { CreateThingSchema } from './<feature>.validation';
import { thingController } from './<feature>.controller';

const router = Router();

router.post(
  '/',
  authenticate,
  validate(CreateThingSchema),
  asyncHandler(thingController.create)
);

export default router;
```

## Controller Template

```ts
// <feature>.controller.ts
import { Request, Response } from 'express';
import { thingService } from './<feature>.service';

export const thingController = {
  create: async (req: Request, res: Response) => {
    const result = await thingService.create(req.body, req.user!.id);
    res.status(201).json({ data: result });
  },
};
```

## Validation Template

```ts
// <feature>.validation.ts
import { z } from 'zod';

export const CreateThingSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    date: z.string().date(),
  }),
});
```

## Constraints

- All route inputs validated with Zod before use
- `authenticate` middleware on every non-public route
- No raw SQL string interpolation — use Supabase client parameterized queries
- No secrets or env vars hardcoded in source — read from `config/`
- Response shape: `{ data: T }` for success, `{ error: string }` for errors
- Use `asyncHandler` wrapper on all async route handlers

## Validation

```bash
npx tsc --noEmit -p services/api/tsconfig.json
cd services/api && npm run build
```
