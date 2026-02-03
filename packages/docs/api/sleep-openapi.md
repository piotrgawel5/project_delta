# Sleep API OpenAPI Specification Updates

## Version: 1.2.0

This document describes the API changes for the Sleep feature production quality implementation.

---

## New Endpoints

### POST /sleep/sync-batch

Batch sync sleep records for offline-first operation.

**Request Body:**

```yaml
type: object
properties:
  records:
    type: array
    items:
      $ref: '#/components/schemas/SleepRecordWithScore'
required:
  - records
```

**Response 200:**

```yaml
type: object
properties:
  synced:
    type: integer
    description: Number of records synced
  conflicts:
    type: array
    items:
      type: object
      properties:
        session_id:
          type: string
        reason:
          type: string
```

---

### PATCH /sleep/log/{session_id}/edit

Edit an existing sleep record with provenance tracking.

**Path Parameters:**

- `session_id` (string, required): Sleep session ID

**Request Body:**

```yaml
type: object
properties:
  changes:
    type: object
    description: Fields to update
  edit_reason:
    type: string
    description: Reason for edit (required)
    minLength: 3
required:
  - changes
  - edit_reason
```

**Response 200:**

```yaml
$ref: '#/components/schemas/SleepRecordWithScore'
```

---

## Updated Endpoints

### GET /sleep/{userId}/log/{date}

Added query parameters for selective data fetching.

**Query Parameters:**

- `include` (string, optional): Comma-separated list of fields
  - Options: `stages`, `score_breakdown`, `edits`, `screen_time`

---

## New Schemas

### SleepScoreBreakdown

```yaml
type: object
properties:
  duration_norm:
    type: number
    description: Normalized duration score (0-35)
  deep_pct:
    type: number
    description: Deep sleep percentage score (0-20)
  rem_pct:
    type: number
    description: REM sleep percentage score (0-20)
  efficiency:
    type: number
    description: Sleep efficiency score (0-15)
  consistency:
    type: number
    description: 7-day consistency score (0-10)
  total:
    type: integer
    description: Total sleep score (0-100)
    minimum: 0
    maximum: 100
```

### SleepRecordWithScore

```yaml
type: object
properties:
  session_id:
    type: string
    format: uuid
  user_id:
    type: string
    format: uuid
  date:
    type: string
    format: date
  start_time:
    type: string
    format: date-time
  end_time:
    type: string
    format: date-time
  duration_minutes:
    type: integer
    minimum: 0
  deep_sleep_minutes:
    type: integer
  rem_sleep_minutes:
    type: integer
  light_sleep_minutes:
    type: integer
  awake_minutes:
    type: integer
  sleep_score:
    type: integer
    minimum: 0
    maximum: 100
  score_breakdown:
    $ref: '#/components/schemas/SleepScoreBreakdown'
  source:
    type: string
    enum: [health_connect, digital_wellbeing, usage_stats, wearable, manual]
  confidence:
    type: string
    enum: [high, medium, low]
  estimated_bedtime:
    type: string
    format: date-time
  estimated_wakeup:
    type: string
    format: date-time
  edits:
    type: array
    items:
      $ref: '#/components/schemas/SleepEditRecord'
```

### SleepEditRecord

```yaml
type: object
properties:
  edited_at:
    type: string
    format: date-time
  edited_by:
    type: string
  edit_reason:
    type: string
  prev_values:
    type: object
    additionalProperties: true
required:
  - edited_at
  - edited_by
  - edit_reason
```

### CircadianAlignment

```yaml
type: object
properties:
  score:
    type: number
    minimum: 0
    maximum: 10
  bedtime_offset:
    type: integer
    description: Minutes from ideal bedtime
  wake_time_offset:
    type: integer
    description: Minutes from ideal wake time
  consistency_score:
    type: number
  recommendation:
    type: string
```

### SleepDebt

```yaml
type: object
properties:
  total_debt_minutes:
    type: integer
  avg_daily_debt_minutes:
    type: integer
  debt_level:
    type: string
    enum: [none, mild, moderate, severe]
  days_in_debt:
    type: integer
  needs_recovery:
    type: boolean
  recommendation:
    type: string
```

---

## Security

All endpoints require authentication via Bearer token.

```yaml
security:
  - bearerAuth: []
```
