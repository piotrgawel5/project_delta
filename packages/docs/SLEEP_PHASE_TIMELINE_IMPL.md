# Sleep Phase Timeline Prediction — Implementation Reference

> **Who this is for**: Codex (the agent implementing this feature). Read the entire document before writing any code. This document is the authoritative spec. Where it conflicts with `SLEEP_ALGORITHM_AGENT_PROMPT_v2.md`, this document wins because it supersedes it on the timeline/phase prediction subsystem.

---

## 1. What We're Building and Why It's Possible

The goal is to produce a **timestamped hypnogram** — a per-minute breakdown of sleep stages with absolute ISO timestamps — for each sleep session, without any wearable sensors.

### 1.1 The Critical Reframing

This is not a classification problem ("what stage was the user in at 02:14?"). It is a **distribution problem**:

> "The app already knows the user had 85 minutes of deep sleep and 102 minutes of REM across their 7h40m session. Place those known budgets onto a timeline according to physiologically validated temporal rules."

This reframing is what makes the feature tractable without sensors. We are not predicting unknown quantities — the `sleep_data` table already stores `deep_sleep_minutes`, `rem_sleep_minutes`, `light_sleep_minutes`, and `awake_minutes`. Our job is to distribute them in time using sleep science, not to guess their totals.

### 1.2 Honest Accuracy Expectations

Even gold-standard wearables (Oura Ring, Apple Watch, Galaxy Watch) with PPG and accelerometer achieve only **69–77% per-epoch accuracy** vs PSG. Without sensors, we cannot match that. Realistic expectations for our approach:

- Stage boundaries accurate to **±15–25 minutes** (worse for users with <7 nights of history)
- Correct sequencing of N3→REM temporal shift across the night: **~70% of nights**
- First-cycle deep sleep placement: **~80% accurate** (strongly governed by universal biology)

These are comparable to early consumer sleep tracking apps and are genuinely useful for trend analysis and user insight — provided we are honest with users about uncertainty. Always label outputs as "Estimated" or "Predicted", never "Measured".

---

## 2. Scientific Foundation

### 2.1 Borbély's Two-Process Model (the core framework)

The entire algorithm is grounded in this model, which is the dominant conceptual framework in sleep science for four decades. It defines two interacting processes:

**Process S — Homeostatic Sleep Pressure**
Sleep pressure that builds exponentially during waking and decays exponentially during sleep. Its time course is derived from slow-wave activity (SWA) in the EEG — specifically delta wave power, which is high at the start of sleep and declines through the night.

Key implication for our algorithm: **N3 (deep/SWS) is front-loaded because it is driven by sleep pressure discharge**. The first sleep cycles absorb the bulk of accumulated Process S. As S decays, later cycles have progressively less N3.

Mathematical form:
```
S_decay_during_sleep ∝ exp(-t / τ_s)    where τ_s ≈ 4.2 hours in humans
```

We implement this as an exponential weight series for N3 budget allocation across cycles.

**Process C — Circadian Pacemaker**
A ~24-hour sine-wave oscillator controlled by the suprachiasmatic nucleus (SCN). It gates REM sleep — REM is facilitated in the biological morning (late sleep) and suppressed in the biological evening (early sleep). Process S inhibits REM, so as S decays across the night, the circadian REM gate opens progressively wider.

Key implication: **REM is back-loaded**. First REM episode is 1–5 minutes. Final REM episode can exceed 60 minutes.

**Source**: Borbély AA. "A two process model of sleep regulation." Human Neurobiology 1:195–204, 1982. Reappraised in Borbély et al., Journal of Sleep Research, 2016.

### 2.2 Ultradian Cycle Architecture — Quantitative PSG Evidence

From polysomnographically-recorded cycles (n = 6,064 cycles, 369 participants, Basel Centre for Chronobiology, published in ScienceDirect 2023):

- **Median cycle duration**: 96 minutes
- **First cycle**: consistently shorter than subsequent cycles — empirically 70–100 minutes
- **Cycles 2–N**: 90–120 minutes
- **Cycle count**: typically 4–6 per 8-hour sleep opportunity

Within-cycle N3 duration (PSG normative data):
- **Cycle 1**: N3 = 20–40 minutes (peak of Process S discharge)
- **Cycle 2**: N3 = 10–20 minutes (S substantially reduced)
- **Cycle 3**: N3 = 5–10 minutes (minimal S remaining)
- **Cycles 4+**: N3 = 0–5 minutes ("minimal delta wave activity")

Within-cycle REM duration:
- **Cycle 1**: REM = 1–5 minutes (Process C circadian gate nearly closed at night onset)
- **Cycle 2**: REM = 10–20 minutes
- **Cycle 3**: REM = 20–30 minutes
- **Cycle 4**: REM = 30–60 minutes (biological morning, circadian gate fully open)

The canonical within-cycle ordering from NCBI StatPearls (standard textbook reference):
```
N1 (light) → N2 (light) → N3 (deep) → N2 (light) → REM → brief wake/arousal
```

**Sources**:
- Ultradian cycles study: ScienceDirect 2023, 6,064 PSG-recorded cycles
- NCBI BookShelf "Sleep Disorders and Sleep Deprivation", Carskadon & Dement 2005
- PMC article "Drug-related Sleep Stage Changes": "Duration of N3 decreases each cycle; REM increases with each cycle. During cycles 3 and 4, minimal delta activity; REM periods 20–30 min."
- Sleep Foundation reference data: "Early N3 stages last 20–40 min; as night continues, stages shorten and REM lengthens."

### 2.3 Key Modifiers from Evidence

**Sleep Pressure / Debt Rebound**
High sleep pressure (prior sleep deprivation) leads to longer NREM sleep in the first cycle. Quantitatively: sleep debt of 120 min → estimated +15–25% extra N3 in cycle 1. This is the single strongest modifier available without sensors.

Source: Basel 2023 study — "High sleep pressure led to longer NREM sleep in the first cycle."

**Age Effects (PSG reference data from JCSM 2023, n=206)**
- N3 decreases with age: approximately 2% of TST per decade after age 25
- Older individuals have longer NREM duration but shorter REM sleep, especially in the late night
- Females have deeper sleep than males (less N1%, more N3% at same age)

**Circadian Timing (Start Time Effect)**
REM percentage in cycle 1 is highest between 06:00–10:00 and lowest between 20:00–22:00. If a user sleeps at 23:00, their first REM is minimal and grows slowly. If they take a nap at 08:00, they may enter REM almost immediately. Our algorithm uses `start_time` to apply this adjustment.

**Personal Historical Calibration**
The strongest personalization signal. A user's consistent `deep_sleep_minutes / duration_minutes` ratio across 7+ nights tells us their real-world Process S baseline — whether they're a deep sleeper or light sleeper. We use this to calibrate the exponential decay rate so the cycle-by-cycle N3 allocation sums to their actual measured `deep_sleep_minutes`.

---

## 3. Data Available (from existing Supabase schema)

Read from `sleep_data` table (exact column names, no guessing):

```
start_time             → timeline anchor (ISO string — convert to Date for arithmetic)
end_time               → timeline end (ISO string)
duration_minutes       → total sleep time (the budget)
deep_sleep_minutes     → N3 budget to distribute
rem_sleep_minutes      → REM budget to distribute
light_sleep_minutes    → N1+N2 budget to distribute
awake_minutes          → WASO budget to distribute as micro-arousals
```

Read from `user_profiles` table:

```
date_of_birth          → compute age → affects N3/REM baseline targets
sex                    → 'male'|'female'|null → females have ~2–3% more N3
activity_level         → feeds VO2max estimation → feeds sleep onset latency (SOL) estimate
```

Read from historical `sleep_data` (last 7–14 nights for same `user_id`):

```
deep_sleep_minutes / duration_minutes  → personal N3 ratio baseline
rem_sleep_minutes / duration_minutes   → personal REM ratio baseline
start_time (hour component)            → chronotype / circadian anchor
duration_minutes average               → normal sleep duration baseline for debt calc
```

### 3.1 Missing Data Handling Priority

```
1. Real stage totals exist (deep/rem/light/awake all non-null) → use as budget, distribute
2. Some stage totals missing → use existing ones as anchors, estimate missing via age baseline
3. No stage totals at all → derive from age/sex baseline percentages × duration_minutes
4. No start_time/end_time → cannot generate timeline, skip premium prediction silently
```

If `start_time` or `end_time` is null, return null for the phase timeline. Do not fabricate timestamps.

---

## 4. The Algorithm: Step-by-Step

### Step 1 — Resolve Stage Budgets

```ts
const deepBudget  = record.deep_sleep_minutes  ?? Math.round(duration * ageDeepTarget);
const remBudget   = record.rem_sleep_minutes   ?? Math.round(duration * ageRemTarget);
const awakeBudget = record.awake_minutes       ?? Math.round(duration * 0.07);
const lightBudget = duration - deepBudget - remBudget - awakeBudget;
// clamp lightBudget ≥ 5 minutes; if negative, trim deep/rem proportionally
```

### Step 2 — Compute Sleep Onset Latency (SOL)

SOL is the pre-sleep awake phase. It appears as `stage='awake', cycleNumber=0` at the very start of the timeline. It is carved out of `awakeBudget`.

Estimate from physiology (since we don't have measured SOL in the schema):

```ts
// Higher fitness → faster sleep onset (validated in exercise physiology literature)
// estimatedVO2Max comes from sleepPhysiologyEstimator.ts (already built)
const sol = estimatedRestingHR > 70 ? 18
           : estimatedRestingHR > 58 ? 13
           : estimatedRestingHR > 48 ? 9
           : 7;   // all values in minutes

// Age adjustment: older adults have longer sleep onset
const ageSOLAdj = Math.max(0, (age - 40) * 0.15);   // +0.15 min per year after 40
const finalSOL  = clamp(Math.round(sol + ageSOLAdj), 5, 30);

// Deduct from awakeBudget
awakeBudget -= finalSOL;
```

### Step 3 — Determine Cycle Count

```ts
const remainingAfterSOL = duration - finalSOL;
const rawCycles = remainingAfterSOL / 96;           // 96 min = median PSG cycle length
const estimatedCycles = clamp(Math.round(rawCycles), 3, 6);
```

### Step 4 — Compute Cycle Lengths

First cycle is shorter (PSG evidence: 70–100 min vs 90–120 for subsequent):

```ts
const cycle1Duration = clamp(
  Math.round(remainingAfterSOL / (estimatedCycles + 0.3)),
  70, 100
);
const remainingForCycles2toN = remainingAfterSOL - cycle1Duration;
const laterCycleDuration = estimatedCycles > 1
  ? Math.round(remainingForCycles2toN / (estimatedCycles - 1))
  : 0;
// clamp laterCycleDuration to [85, 120]

const cycleLengths = [cycle1Duration, ...Array(estimatedCycles - 1).fill(laterCycleDuration)];
// Adjust final cycle to absorb any rounding remainder
cycleLengths[cycleLengths.length - 1] += remainingAfterSOL - cycleLengths.reduce((a,b) => a+b, 0);
```

### Step 5 — Distribute N3 Budget Across Cycles (Exponential Decay)

This is the mathematical heart of the Borbély model applied to cycle allocation.

```ts
// Exponential weights: cycle i gets weight exp(-λ × i), i is 0-indexed
// λ = 0.7 gives good fit to PSG normative data across 4-5 cycles
const λ = 0.7;
const rawWeights  = cycleLengths.map((_, i) => Math.exp(-λ * i));
const totalWeight = rawWeights.reduce((a, b) => a + b, 0);
const deepPerCycle = rawWeights.map(w => Math.round(deepBudget * w / totalWeight));

// Sleep debt rebound modifier: boost cycle 1 N3
if (recentSleepDebt > 60) {
  const debtBoost = Math.min(0.25, recentSleepDebt / 960);  // max +25% to cycle 1
  const transfer  = Math.round(deepPerCycle[0] * debtBoost);
  deepPerCycle[0] += transfer;
  // Trim proportionally from later cycles that have N3 budget
  const donorCycles = deepPerCycle.slice(1).filter(d => d > 0);
  // ... distribute trim across donor cycles proportionally
}

// Ensure sum equals deepBudget exactly (fix rounding)
const deepSum = deepPerCycle.reduce((a, b) => a + b, 0);
deepPerCycle[deepPerCycle.length - 1] += deepBudget - deepSum;
```

### Step 6 — Distribute REM Budget Across Cycles (Logarithmic Growth)

Inverse of N3: REM grows across the night as Process S decays and Process C (circadian) opens.

```ts
// Logarithmic growth weights: cycle i gets weight log(1 + growthFactor × (i + 1))
// growthFactor = 1.0 gives empirically good fit across 4-5 cycles
const growthFactor = 1.0;
const remRawWeights  = cycleLengths.map((_, i) => Math.log(1 + growthFactor * (i + 1)));
const remTotalWeight = remRawWeights.reduce((a, b) => a + b, 0);
const remPerCycle    = remRawWeights.map(w => Math.round(remBudget * w / remTotalWeight));

// First REM episode minimum: clamp cycle 1 REM to [1, 8] minutes (PSG: first REM is 1–5 min)
remPerCycle[0] = clamp(remPerCycle[0], 1, 8);

// Redistribute excess from cycle 1 clamp to later cycles proportionally
// ... same rounding fix as N3
```

**Circadian start-time adjustment on REM**:

```ts
const bedtimeHour = new Date(startTime).getHours();
// REM gating: sleeping early (22:00–23:00) → first REM strongly suppressed
// Sleeping late (01:00–03:00) → first REM slightly less suppressed
if (bedtimeHour >= 22 && bedtimeHour <= 23) {
  remPerCycle[0] = Math.max(1, Math.round(remPerCycle[0] * 0.5));
} else if (bedtimeHour >= 0 && bedtimeHour <= 3) {
  remPerCycle[0] = Math.min(remPerCycle[0], 10);  // still limited but less so
}
// Redistribute difference to later cycles
```

### Step 7 — Distribute Light and Awake Budgets

Light sleep fills the remainder of each cycle after N3 and REM are allocated. Awake (micro-arousals) are placed at cycle boundaries.

```ts
for (let c = 0; c < estimatedCycles; c++) {
  const n3 = deepPerCycle[c];
  const rem = remPerCycle[c];
  // Micro-arousal at cycle boundary: 1–3 min from awakeBudget
  const microArousal = awakeBudget > 3 ? 2 : (awakeBudget > 0 ? 1 : 0);
  awakeBudget -= microArousal;
  const light = cycleLengths[c] - n3 - rem - microArousal;
  lightAllocations[c] = Math.max(5, light);  // enforce min 5 min light per cycle
}
// If lightBudget didn't distribute fully, absorb into last cycle's light phase
```

### Step 8 — Build the Flat Phase Timeline with ISO Timestamps

This is what gets stored in `sleep_phase_timeline` and returned as `SleepPhaseEvent[]`.

```ts
let cursor = new Date(startTime).getTime();  // milliseconds
const events: SleepPhaseEvent[] = [];

// Phase 0: pre-sleep awake
events.push({
  stage: 'awake',
  startTime: new Date(cursor).toISOString(),
  endTime:   new Date(cursor + finalSOL * 60_000).toISOString(),
  durationMinutes: finalSOL,
  cycleNumber: 0,
});
cursor += finalSOL * 60_000;

// Phases 1..N: cycle contents
for (let c = 0; c < estimatedCycles; c++) {
  const cycleN3    = deepPerCycle[c];
  const cycleREM   = remPerCycle[c];
  const cycleMicro = microArousals[c];
  const cycleLight = cycleLengths[c] - cycleN3 - cycleREM - cycleMicro;

  // Split light into descent (before N3) and ascent (after N3, before REM)
  const lightDescent = Math.round(cycleLight * 0.45);
  const lightAscent  = cycleLight - lightDescent;

  const phases: Array<[SleepStage, number]> = [
    ['light', lightDescent],
    ['deep',  cycleN3],
    ['light', lightAscent],
    ['rem',   cycleREM],
  ];
  if (cycleMicro > 0) phases.push(['awake', cycleMicro]);

  for (const [stage, mins] of phases) {
    if (mins <= 0) continue;
    events.push({
      stage,
      startTime:       new Date(cursor).toISOString(),
      endTime:         new Date(cursor + mins * 60_000).toISOString(),
      durationMinutes: mins,
      cycleNumber:     c + 1,
    });
    cursor += mins * 60_000;
  }
}

// Final adjustment: stretch or shrink last event to hit endTime exactly
const targetEnd = new Date(endTime).getTime();
const lastEvent = events[events.length - 1];
const drift = targetEnd - new Date(lastEvent.endTime).getTime();
if (Math.abs(drift) <= 5 * 60_000) {   // allow up to 5 min drift correction
  const newEnd = new Date(targetEnd).toISOString();
  const newDur = lastEvent.durationMinutes + Math.round(drift / 60_000);
  events[events.length - 1] = { ...lastEvent, endTime: newEnd, durationMinutes: newDur };
}

// INVARIANT CHECK — throw if violated
const totalMins = events.reduce((sum, e) => sum + e.durationMinutes, 0);
if (Math.abs(totalMins - duration) > 1) {
  throw new Error(`Timeline invariant violated: ${totalMins} min ≠ ${duration} min`);
}
// INVARIANT CHECK — no gaps
for (let i = 1; i < events.length; i++) {
  if (events[i].startTime !== events[i-1].endTime) {
    throw new Error(`Timeline gap at index ${i}: ${events[i-1].endTime} → ${events[i].startTime}`);
  }
}
```

### Step 9 — Determine Confidence Level

```ts
function computeConfidence(
  hasRealStageData: boolean,
  historyNights: number,
  hasSex: boolean,
  hasAge: boolean
): 'high' | 'medium' | 'low' {
  if (hasRealStageData && historyNights >= 7) return 'high';
  if (hasRealStageData && historyNights >= 3) return 'medium';
  if (hasRealStageData || historyNights >= 3) return 'medium';
  return 'low';
}
```

---

## 5. Personal Calibration (the personalisation layer)

After having ≥7 nights of history, compute these from the historical `sleep_data` rows:

```ts
// Personal N3 ratio (user's actual average, not population average)
const personalDeepRatio = avg(history.map(r => r.deep_sleep_minutes / r.duration_minutes));
// Personal REM ratio
const personalRemRatio  = avg(history.map(r => r.rem_sleep_minutes / r.duration_minutes));
// Personal cycle length estimate
const personalCycleLen  = avg(history.map(r => r.duration_minutes / estimateCycleCount(r)));
// Personal SOL estimate (if estimated_bedtime and start_time both present)
const personalSOL = avg(history
  .filter(r => r.estimated_bedtime && r.start_time)
  .map(r => diffMinutes(r.estimated_bedtime, r.start_time))
);
```

Apply calibration: blend 60% algorithm output + 40% personal historical values for deepPerCycle and remPerCycle allocations. This is the key differentiator from a cold-start population model.

---

## 6. New File to Create

```
apps/mobile/lib/sleepCycleDistributor.ts
```

This is a **pure function module** — no imports from stores, no side effects, no Supabase calls. It takes inputs and returns a `SleepPhaseEvent[]`. The store calls it and handles persistence.

### Exported API

```ts
export interface CycleDistributorInput {
  // From sleep_data record
  startTime:          string;          // ISO string — required, return null if missing
  endTime:            string;          // ISO string — required, return null if missing
  durationMinutes:    number;
  deepSleepMinutes:   number | null;
  remSleepMinutes:    number | null;
  lightSleepMinutes:  number | null;
  awakeSleepMinutes:  number | null;

  // From estimatePhysiology() — always available for premium users
  estimatedRestingHR:    number;
  estimatedVO2Max:       number;
  age:                   number;
  sex:                   'male' | 'female' | null;

  // From history computation — optional
  recentSleepDebt?:      number;        // minutes below 480 goal, avg last 3 nights
  personalDeepRatio?:    number;        // 0..1, avg last 7 nights
  personalRemRatio?:     number;        // 0..1
  personalCycleLength?:  number;        // minutes
  historyNightCount?:    number;        // for confidence scoring
}

export interface CycleDistributorOutput {
  phaseTimeline:     SleepPhaseEvent[];   // ordered by startTime, no gaps
  estimatedCycles:   number;
  cycleBreakdown:    CycleBreakdown[];
  confidence:        'high' | 'medium' | 'low';
  algorithmVersion:  number;             // increment when algo changes, for DB generation_v
}

export function distributeSleepcycles(input: CycleDistributorInput): CycleDistributorOutput | null
// Returns null if startTime or endTime is missing/invalid
```

---

## 7. Database: `sleep_phase_timeline` Table & RLS

The table was manually created. Apply the following RLS policies exactly.

### 7.1 Enable RLS

```sql
ALTER TABLE public.sleep_phase_timeline ENABLE ROW LEVEL SECURITY;
```

### 7.2 SELECT Policy — Users Read Only Their Own Rows

```sql
CREATE POLICY "Users can read their own sleep phase timeline"
  ON public.sleep_phase_timeline
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
```

### 7.3 INSERT Policy — Users Insert Only Their Own Rows

```sql
CREATE POLICY "Users can insert their own sleep phase timeline"
  ON public.sleep_phase_timeline
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

### 7.4 UPDATE Policy — Users Update Only Their Own Rows

```sql
CREATE POLICY "Users can update their own sleep phase timeline"
  ON public.sleep_phase_timeline
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### 7.5 DELETE Policy — Users Delete Only Their Own Rows

```sql
CREATE POLICY "Users can delete their own sleep phase timeline"
  ON public.sleep_phase_timeline
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
```

### 7.6 Service Role Bypass (for any future server-side jobs or edge functions)

```sql
CREATE POLICY "Service role has full access"
  ON public.sleep_phase_timeline
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### 7.7 Verify Policies Are Active

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'sleep_phase_timeline'
ORDER BY cmd;
```

Expected output: 5 rows (SELECT, INSERT, UPDATE, DELETE, ALL).

---

## 8. Persistence Strategy

Unlike `premiumPrediction` (which was ephemeral in the v2 prompt), phase timeline data **is persisted** to Supabase. This is the premium artifact.

### 8.1 Upsert Logic

Use upsert (not insert) so re-running the algorithm for the same `sleep_data_id` replaces old rows rather than duplicating them.

```ts
// In sleepStore.ts, inside the isPaidPlan() block, after buildPremiumPrediction():
const { distributeSleepcycles } = await import('@lib/sleepCycleDistributor');

const distOutput = distributeSleepcycles({ ...inputs });
if (distOutput) {
  // Delete old timeline rows for this sleep session first, then insert new ones
  // (Supabase doesn't support per-sleep_data_id upsert easily for array rows)
  await supabase
    .from('sleep_phase_timeline')
    .delete()
    .eq('sleep_data_id', record.id)
    .eq('user_id', currentUser.id);

  const rows = distOutput.phaseTimeline.map(event => ({
    sleep_data_id:    record.id,
    user_id:          currentUser.id,
    cycle_number:     event.cycleNumber,
    stage:            event.stage,
    start_time:       event.startTime,
    end_time:         event.endTime,
    duration_minutes: event.durationMinutes,
    confidence:       distOutput.confidence,
    generation_v:     distOutput.algorithmVersion,
  }));

  const { error } = await supabase
    .from('sleep_phase_timeline')
    .insert(rows);

  if (error) {
    // Log but don't throw — timeline failure must not block the main sleep fetch
    console.warn('[SleepStore] Phase timeline persist failed:', error.message);
  }

  // Also attach to the in-memory record for immediate UI consumption
  record.premiumPrediction = {
    ...record.premiumPrediction,
    cycleMap: {
      estimatedCycles: distOutput.estimatedCycles,
      phaseTimeline:   distOutput.phaseTimeline,
      cycleBreakdown:  distOutput.cycleBreakdown,
    },
  };
}
```

### 8.2 When to Regenerate

Regenerate the timeline whenever:
- The `sleep_data` record is updated (e.g., user edits stage totals)
- The algorithm version (`algorithmVersion`) in `distributeSleepcycles` is bumped
- The user profile's `date_of_birth`, `sex`, or `activity_level` changes

Do NOT regenerate on every fetch if rows already exist for that `sleep_data_id` AND `generation_v` matches the current algorithm version. Add this check to avoid unnecessary writes:

```ts
const { data: existingRows } = await supabase
  .from('sleep_phase_timeline')
  .select('generation_v')
  .eq('sleep_data_id', record.id)
  .limit(1)
  .single();

const CURRENT_ALGO_VERSION = 1;  // bump this number each time the algorithm changes

if (existingRows?.generation_v === CURRENT_ALGO_VERSION) {
  // Fetch existing rows into memory instead of regenerating
  const { data: timeline } = await supabase
    .from('sleep_phase_timeline')
    .select('*')
    .eq('sleep_data_id', record.id)
    .order('start_time', { ascending: true });
  // Map to SleepPhaseEvent[] and attach to record
  return;
}
// Otherwise regenerate
```

---

## 9. TypeScript Types to Add

These extend the types already defined in `SLEEP_ALGORITHM_AGENT_PROMPT_v2.md`. Add to `packages/shared/src/types/`:

```ts
// Matches the sleep_phase_timeline table columns exactly
export interface SleepPhaseTimelineRow {
  id:               string;
  sleep_data_id:    string;
  user_id:          string;
  cycle_number:     number;
  stage:            'awake' | 'light' | 'deep' | 'rem';
  start_time:       string;   // ISO
  end_time:         string;   // ISO
  duration_minutes: number;
  confidence:       'high' | 'medium' | 'low';
  generation_v:     number;
  created_at:       string;
}

export interface CycleBreakdown {
  cycleNumber:     number;
  startTime:       string;
  endTime:         string;
  durationMinutes: number;
  dominantStage:   'deep' | 'rem' | 'light';
  deepMinutes:     number;
  remMinutes:      number;
  lightMinutes:    number;
  awakeMinutes:    number;
}
```

---

## 10. Unit Tests for `sleepCycleDistributor.ts`

File: `apps/mobile/lib/__tests__/sleepCycleDistributor.test.ts`

```
1. Input with all real stage totals, 8h duration, 23:30 start
   → phaseTimeline is not null
   → sum of durationMinutes == 480 ±1
   → first event: stage='awake', cycleNumber=0
   → no gaps: every event[i].endTime === event[i+1].startTime
   → estimatedCycles in [3,6]
   → deep events front-loaded: sum(deep in first half of night) > sum(deep in second half)
   → rem events back-loaded: sum(rem in second half) > sum(rem in first half)

2. Input with null stage totals → falls back to age baseline → still produces valid timeline

3. Missing startTime → returns null (no crash)

4. Sleep debt 250 min → cycle 1 deep minutes > same input with 0 debt

5. Age 65 → deepPerCycle[0] is less than age 25 with same duration and debt

6. Cycle count: 5h duration → 3 cycles; 8h duration → 4-5 cycles; 9h duration → 5-6 cycles

7. All durationMinutes in timeline are positive integers (no zero-minute or negative events)

8. algorithmVersion field is present and is a positive integer

9. cycleBreakdown length === estimatedCycles

10. Last event endTime === input endTime (within 1 minute tolerance)
```

---

## 11. What NOT to Do

- **Do not** invent an ML model, train weights, or use any ML library. The algorithm is pure deterministic math derived from the physiology above.
- **Do not** persist `premiumPrediction` (the in-memory object from v2 prompt) to Supabase — only `sleep_phase_timeline` rows go to the DB.
- **Do not** call `distributeSleepcycles()` for free plan users — it must be inside the `isPaidPlan()` block.
- **Do not** throw or crash if phase timeline generation fails — catch errors, log a warning, continue. The main sleep data fetch must succeed regardless.
- **Do not** rename the `SleepPhaseEvent` fields. They must match `SleepStage` in `SleepTimeline.tsx` exactly for future chart integration.
- **Do not** generate timelines for records where `start_time` or `end_time` is null. Return null silently.
- **Do not** store more than one set of rows per `sleep_data_id` — always delete-then-insert, never append.

---

## 12. Algorithm Constants (for easy future tuning)

Centralise these in `sleepCycleDistributor.ts` as a single exported constants object so they can be tuned without hunting through logic:

```ts
export const CYCLE_DISTRIBUTOR_CONSTANTS = {
  ALGO_VERSION:         1,       // bump when algorithm changes materially
  MEDIAN_CYCLE_MINUTES: 96,      // PSG median, Basel 2023
  CYCLE1_MIN:           70,      // PSG first cycle minimum
  CYCLE1_MAX:           100,     // PSG first cycle maximum
  LATER_CYCLE_MIN:      85,
  LATER_CYCLE_MAX:      120,
  MIN_CYCLES:           3,
  MAX_CYCLES:           6,
  N3_DECAY_LAMBDA:      0.7,     // exponential decay rate — higher = steeper front-loading
  REM_GROWTH_FACTOR:    1.0,     // logarithmic growth rate — higher = steeper back-loading
  SOL_MIN_MINUTES:      5,
  SOL_MAX_MINUTES:      30,
  CYCLE1_REM_MAX:       8,       // PSG: first REM episode rarely exceeds 5–8 min
  MICRO_AROUSAL_MINS:   2,       // typical cycle-boundary arousal duration
  MAX_DRIFT_CORRECTION: 5,       // minutes of endTime drift we'll silently correct
  HISTORY_HIGH_CONF:    7,       // nights of history for 'high' confidence
  HISTORY_MED_CONF:     3,       // nights for 'medium' confidence
} as const;
```

---

## 13. Future Extension Points (context only, do not implement now)

- **Sleep Stage Editing UI**: Users can drag stage boundaries in the hypnogram chart. Edits would update the `sleep_phase_timeline` rows directly and set a `user_edited = true` flag (column not yet in schema — add when UI is built).
- **Algorithm v2**: When wearable HR data becomes available (Apple Health import, etc.), replace the estimated physiology inputs with real sensor values. The `generation_v` column handles invalidation and regeneration.
- **Chart integration**: `phaseTimeline: SleepPhaseEvent[]` from `cycleMap` feeds directly into the future sleep hypnogram chart component as `TimelineData.stages`. No adapter needed — the field names already match.
