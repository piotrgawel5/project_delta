# Changelog

All notable changes to Project Delta will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Sleep Feature - Production Quality Implementation

**P0 - Data Correctness & Scoring**

- Deterministic Sleep Score (0-100) with reproducible, documented weights
- Score breakdown with component values: duration (35%), deep (20%), REM (20%), efficiency (15%), consistency (10%)
- Data source tracking: `health_connect`, `digital_wellbeing`, `usage_stats`, `wearable`, `manual`
- Confidence levels: `high`, `medium`, `low` based on data completeness
- Unit tests covering edge cases (0 duration, all deep sleep, missing REM)

**P0 - Screen Time Native Module**

- Android Kotlin module (`ScreenTimeModule.kt`) using `UsageStatsManager`
- Bedtime/wakeup estimation algorithm from screen on/off events
- Permission flow UI with privacy explanation
- TypeScript bridge with fully typed interface

**P0 - API Changes**

- `POST /sleep/sync-batch` for offline-first batched sync
- `PATCH /sleep/log/:session_id/edit` with required `edit_reason`
- `GET /sleep/:userId/log/:date?include=` query params
- SQL migrations for new schema fields

**P1 - Interactive Timeline**

- `SleepTimeline.tsx` component with tappable stages
- Drag-to-scrub with real-time time display
- Stage duration tooltips and summary

**P1 - Edit History & Provenance**

- `EditHistoryBadge.tsx` component
- Full edit history with previous/new values
- Source and confidence display

**P1 - AI Insight Card**

- `InsightCard.tsx` component
- Top 3 contributing factors with weights
- Predicted score delta with confidence
- Personalized recommendations

**P2 - Circadian & Sleep Debt**

- `calculateCircadianAlignment()` - 0-10 score for rhythm alignment
- `calculateRollingSleepDebt()` - 7-day rolling calculation
- `generateBedtimeCoachingPlan()` - 5-night progressive adjustment
- `shouldOfferBedtimePlan()` - Smart offer detection

### Changed

- Sleep screen now displays numeric score instead of qualitative rating
- 7-day sparkline trend chart added to sleep dashboard

### Fixed

- Type assertion in `sleep.service.ts` for score breakdown

### Migration Notes

- Run `20260201000000_add_sleep_score_and_provenance.sql`
- Rollback available: `20260201000000_add_sleep_score_and_provenance_rollback.sql`
- Add `PACKAGE_USAGE_STATS` permission to AndroidManifest.xml
