# Repository Guidelines

## Project Structure & Module Organization

- `apps/mobile/`: Expo React Native app (primary UI surface).
- `packages/`: Shared code.
- `packages/constants/`, `packages/types/`, `packages/shared/`: Reusable modules.
- `packages/docs/reference_assets/`: Design and UI reference assets (screenshots, videos).
- `services/api/`: Backend API service.
- `services/supabase/`: Supabase configs and tooling.

## Build, Test, and Development Commands

Run these from `apps/mobile` unless noted.

```bash
npm run start    # Start Expo dev server
npm run ios      # Run iOS (simulator/device)
npm run android  # Run Android (emulator/device)
npm run web      # Run Expo web
npm run lint     # ESLint + Prettier check
npm run format   # Auto-fix lint + Prettier
```

Testing uses Jest (root dev dependencies). For mobile unit tests:

```bash
npx jest apps/mobile/lib/__tests__
```

## Coding Style & Naming Conventions

- TypeScript first: prefer `.ts`/`.tsx` for app code.
- Follow ESLint + Prettier rules. Use `npm run format` before PRs.
- Keep filenames descriptive and component-based (`MetricCard.tsx`, `SleepTimeline.ts`).
- Use React component names in PascalCase.

## Testing Guidelines

- Place unit tests under `apps/mobile/lib/__tests__/`.
- Use `.test.ts` naming (see `sleepTimeline.test.ts`).
- Keep tests deterministic and focused on logic, not UI snapshots.

## Commit & Pull Request Guidelines

- Commit messages follow a simple conventional pattern in this repo (e.g., `feat: add sleep tracking`, `fix: adjust chart labels`).
- Keep commits scoped and readable; avoid multi-feature commits.
- PRs should include:
  - A short summary of changes.
  - Screenshots for UI updates (iOS + Android if layout differs).
  - Linked issue or task when applicable.

## Security & Configuration Tips

- Environment files are gitignored (`.env`, `.env.*`). Keep secrets out of the repo.
- Add new shared configuration to `packages/constants` or `packages/shared` rather than duplicating it in `apps/mobile`.
