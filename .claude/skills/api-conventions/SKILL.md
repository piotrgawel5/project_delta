---
name: api-conventions
description: >
  Express/Zod route handler patterns, response shapes, auth middleware rules,
  and Supabase query conventions for Project Delta's API service.
  Apply to every task touching services/api/.
allowed-tools: Read,Grep,Glob,Bash(npx tsc*),Bash(cd services/api && npm run build)
---

# Project Delta — API Conventions

## Module Structure

Every feature lives in `services/api/src/modules/<feature>/`:

```
<feature>.routes.ts       → Router: mounts middleware + handlers
<feature>.controller.ts   → Thin request/response glue
<feature>.service.ts      → Business logic (pure, injectable)
<feature>.validation.ts   → Zod schemas for all inputs
```

## Route Handler Pattern

```ts
// routes.ts
import { Router } from 'express';
import { authenticate } from '../auth/auth.middleware';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { CreateRecordSchema } from './feature.validation';
import { featureController } from './feature.controller';

const router = Router();

// Non-public routes always use authenticate first
router.post('/', authenticate, validate(CreateRecordSchema), asyncHandler(featureController.create));
router.get('/:id', authenticate, asyncHandler(featureController.getById));

export default router;
```

## Controller Pattern (thin)

```ts
// controller.ts
import { Request, Response } from 'express';
import { featureService } from './feature.service';

export const featureController = {
  create: async (req: Request, res: Response) => {
    const data = await featureService.create(req.body, req.user!.id);
    res.status(201).json({ data });
  },

  getById: async (req: Request, res: Response) => {
    const data = await featureService.getById(req.params.id, req.user!.id);
    if (!data) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ data });
  },
};
```

## Validation Pattern (Zod)

```ts
// validation.ts
import { z } from 'zod';

export const CreateRecordSchema = z.object({
  body: z.object({
    date: z.string().date(),                    // YYYY-MM-DD
    duration: z.number().min(0).max(1440),      // minutes
    source: z.enum(['manual', 'health_connect', 'wearable', 'digital_wellbeing', 'usage_stats']),
  }),
  params: z.object({}).optional(),
  query: z.object({}).optional(),
});

export type CreateRecordInput = z.infer<typeof CreateRecordSchema>['body'];
```

## Response Shape

```ts
// Success
res.json({ data: T });
res.status(201).json({ data: T });

// Error (use AppError for known errors)
throw new AppError('Validation failed', 400);
// or direct:
res.status(404).json({ error: 'Not found' });

// Never: { success: boolean, result: T } — inconsistent shape
```

## Auth Middleware

```ts
// middleware: authenticate
// Sets req.user = { id: string } from Supabase JWT
// Throws 401 if token missing or invalid

// Always first in protected route chain:
router.get('/protected', authenticate, validate(Schema), asyncHandler(handler));
```

## Supabase Query Pattern

```ts
// service.ts
import { supabase } from '../../lib/supabase';

async function getSleepByDate(userId: string, date: string) {
  const { data, error } = await supabase
    .from('sleep_logs')
    .select('*')
    .eq('user_id', userId)   // parameterized — never string interpolation
    .eq('date', date)
    .single();

  if (error) throw new AppError(error.message, 500);
  return data;
}
```

## Critical Rules

| Rule | Why |
|------|-----|
| `authenticate` on every non-public route | Unauthorized data access |
| Zod validation before using `req.body` | Type safety + prevents injection |
| No raw SQL string interpolation | SQL injection |
| No secrets in source — use `config/` | Security |
| `asyncHandler` on all async handlers | Unhandled promise rejection crashes server |
| Parameterized Supabase queries (`.eq()`) | SQL injection prevention |

## Validation (after changes)

```bash
npx tsc --noEmit -p services/api/tsconfig.json
cd services/api && npm run build
```
