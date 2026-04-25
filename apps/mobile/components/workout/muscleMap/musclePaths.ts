import type { MuscleGroup } from '@shared';

// ─────────────────────────────────────────────────────────────────────────────
// ViewBox: 0 0 200 180
// Front silhouette: x ∈ [0, 100]   (figure centred at x=50)
// Back silhouette:  x ∈ [100, 200] (figure centred at x=150, same proportions)
//
// Proportions (100×180 half):
//   Head:     circle cx=50 cy=12 r=9
//   Shoulders: y≈30, outer x≈20/80
//   Torso:    waist y≈72, hips y≈96
//   Legs:     split at y≈98, feet at y≈178
//   Arms:     elbow y≈68, wrist y≈98
// ─────────────────────────────────────────────────────────────────────────────

export interface MusclePath {
  readonly d: string;
  readonly side: 'front' | 'back';
}

// ─────────────────────────────────────────────────────────────────────────────
// Silhouette outlines (stroke-only, no fill)
// ─────────────────────────────────────────────────────────────────────────────

export const BODY_OUTLINE_FRONT =
  'M 50 3 C 59 3 61 9 61 13 C 61 21 56 25 55 28 ' +
  'L 74 32 C 79 34 80 40 78 44 ' +
  'L 76 68 L 73 98 L 66 98 ' +
  'L 64 142 L 64 178 L 56 178 L 55 154 L 52 98 L 48 98 L 45 154 L 44 178 ' +
  'L 36 178 L 36 142 L 34 98 L 27 98 ' +
  'L 24 68 L 22 44 C 20 40 21 34 26 32 ' +
  'L 45 28 C 44 25 39 21 39 13 C 39 9 41 3 50 3 Z';

export const BODY_OUTLINE_BACK =
  'M 150 3 C 159 3 161 9 161 13 C 161 21 156 25 155 28 ' +
  'L 174 32 C 179 34 180 40 178 44 ' +
  'L 176 68 L 173 98 L 166 98 ' +
  'L 164 142 L 164 178 L 156 178 L 155 154 L 152 98 L 148 98 L 145 154 L 144 178 ' +
  'L 136 178 L 136 142 L 134 98 L 127 98 ' +
  'L 124 68 L 122 44 C 120 40 121 34 126 32 ' +
  'L 145 28 C 144 25 139 21 139 13 C 139 9 141 3 150 3 Z';

// Head circles — exported as data for use with <Circle> element
export const HEAD_FRONT = { cx: 50, cy: 12, r: 9 };
export const HEAD_BACK = { cx: 150, cy: 12, r: 9 };

// ─────────────────────────────────────────────────────────────────────────────
// Muscle paths — front [x ∈ 0..100], back [x ∈ 100..200]
// ─────────────────────────────────────────────────────────────────────────────

export const MUSCLE_PATHS: Readonly<Record<MuscleGroup, readonly MusclePath[]>> = {
  // ── FRONT ONLY ──────────────────────────────────────────────────────────────

  chest: [
    {
      side: 'front',
      // Two pectorals meeting at sternum (x=50), y 36–54
      d:
        'M 34 37 C 33 34 46 33 50 43 ' +
        'C 54 33 67 34 66 37 ' +
        'L 64 52 C 58 57 52 56 50 54 ' +
        'C 48 56 42 57 36 52 Z',
    },
  ],

  abs: [
    {
      side: 'front',
      // Rectus abdominis: rectangle-ish between chest and hip, y 56–94
      d: 'M 42 57 L 58 57 L 58 94 C 54 96 46 96 42 94 Z',
    },
  ],

  obliques: [
    {
      side: 'front',
      // Left oblique flank
      d: 'M 34 58 L 42 57 L 42 94 C 38 92 34 86 33 78 Z',
    },
    {
      side: 'front',
      // Right oblique flank
      d: 'M 66 58 L 58 57 L 58 94 C 62 92 66 86 67 78 Z',
    },
  ],

  front_delts: [
    {
      side: 'front',
      // Left front deltoid: rounded cap at shoulder
      d: 'M 26 32 C 22 34 20 40 22 46 L 28 42 L 32 36 Z',
    },
    {
      side: 'front',
      // Right front deltoid
      d: 'M 74 32 C 78 34 80 40 78 46 L 72 42 L 68 36 Z',
    },
  ],

  side_delts: [
    {
      side: 'front',
      // Left side deltoid visible on front — outer arm cap
      d: 'M 20 34 C 17 38 16 46 18 54 L 24 48 L 22 40 Z',
    },
    {
      side: 'front',
      d: 'M 80 34 C 83 38 84 46 82 54 L 76 48 L 78 40 Z',
    },
    {
      side: 'back',
      // Left side deltoid visible on back
      d: 'M 120 34 C 117 38 116 46 118 54 L 124 48 L 122 40 Z',
    },
    {
      side: 'back',
      d: 'M 180 34 C 183 38 184 46 182 54 L 176 48 L 178 40 Z',
    },
  ],

  biceps: [
    {
      side: 'front',
      // Left bicep: front of upper arm, y 48–68
      d: 'M 20 48 C 17 54 17 62 20 68 L 26 66 L 28 50 Z',
    },
    {
      side: 'front',
      // Right bicep
      d: 'M 80 48 C 83 54 83 62 80 68 L 74 66 L 72 50 Z',
    },
  ],

  forearms: [
    {
      side: 'front',
      // Left forearm: y 70–96
      d: 'M 18 70 C 16 78 17 88 20 96 L 26 94 L 28 70 Z',
    },
    {
      side: 'front',
      d: 'M 82 70 C 84 78 83 88 80 96 L 74 94 L 72 70 Z',
    },
    {
      side: 'back',
      // Forearms visible from back too
      d: 'M 118 70 C 116 78 117 88 120 96 L 126 94 L 128 70 Z',
    },
    {
      side: 'back',
      d: 'M 182 70 C 184 78 183 88 180 96 L 174 94 L 172 70 Z',
    },
  ],

  quads: [
    {
      side: 'front',
      // Left quad: y 100–142
      d: 'M 35 100 L 46 100 L 48 140 C 48 143 40 145 37 142 L 35 106 Z',
    },
    {
      side: 'front',
      // Right quad
      d: 'M 65 100 L 54 100 L 52 140 C 52 143 60 145 63 142 L 65 106 Z',
    },
  ],

  hip_flexors: [
    {
      side: 'front',
      // Left hip flexor: inner groin / upper inner thigh
      d: 'M 44 96 L 50 96 L 50 106 L 44 108 Z',
    },
    {
      side: 'front',
      d: 'M 56 96 L 50 96 L 50 106 L 56 108 Z',
    },
  ],

  calves: [
    {
      side: 'front',
      // Left calf: lower leg front y 144–174
      d: 'M 33 144 L 40 144 L 39 172 C 37 174 33 173 32 170 Z',
    },
    {
      side: 'front',
      d: 'M 67 144 L 60 144 L 61 172 C 63 174 67 173 68 170 Z',
    },
    {
      side: 'back',
      // Calves are more visible from back
      d: 'M 133 144 L 140 144 L 139 172 C 137 174 133 173 132 170 Z',
    },
    {
      side: 'back',
      d: 'M 167 144 L 160 144 L 161 172 C 163 174 167 173 168 170 Z',
    },
  ],

  // ── BACK ONLY ───────────────────────────────────────────────────────────────

  traps: [
    {
      side: 'back',
      // Trapezius: upper back, neck to mid-shoulder, y 24–48
      d:
        'M 150 26 C 144 28 130 32 126 38 ' +
        'L 130 44 C 138 40 146 38 150 38 ' +
        'C 154 38 162 40 170 44 ' +
        'L 174 38 C 170 32 156 28 150 26 Z',
    },
  ],

  rear_delts: [
    {
      side: 'back',
      // Left rear deltoid
      d: 'M 126 34 C 122 36 120 42 122 48 L 128 44 L 130 38 Z',
    },
    {
      side: 'back',
      // Right rear deltoid
      d: 'M 174 34 C 178 36 180 42 178 48 L 172 44 L 170 38 Z',
    },
  ],

  triceps: [
    {
      side: 'back',
      // Left tricep: back of upper arm, y 48–68
      d: 'M 120 48 C 117 54 117 62 120 68 L 126 66 L 128 50 Z',
    },
    {
      side: 'back',
      // Right tricep
      d: 'M 180 48 C 183 54 183 62 180 68 L 174 66 L 172 50 Z',
    },
  ],

  upper_back: [
    {
      side: 'back',
      // Rhomboids / mid-traps: between shoulder blades, y 46–72
      d: 'M 134 46 L 166 46 L 164 72 C 156 76 144 76 136 72 Z',
    },
  ],

  lats: [
    {
      side: 'back',
      // Left lat: wing from armpit to lower back — y 40–90, outer x~122..142
      d:
        'M 128 40 C 124 52 122 70 130 88 ' +
        'L 142 86 L 142 74 C 136 62 134 48 136 42 Z',
    },
    {
      side: 'back',
      // Right lat
      d:
        'M 172 40 C 176 52 178 70 170 88 ' +
        'L 158 86 L 158 74 C 164 62 166 48 164 42 Z',
    },
  ],

  lower_back: [
    {
      side: 'back',
      // Erector spinae / lower back, y 76–96
      d: 'M 136 76 L 164 76 L 164 96 C 158 98 142 98 136 96 Z',
    },
  ],

  glutes: [
    {
      side: 'back',
      // Left glute
      d: 'M 134 98 L 150 98 L 150 118 C 146 124 136 122 133 116 Z',
    },
    {
      side: 'back',
      // Right glute
      d: 'M 166 98 L 150 98 L 150 118 C 154 124 164 122 167 116 Z',
    },
  ],

  hamstrings: [
    {
      side: 'back',
      // Left hamstring: rear thigh y 100–140
      d: 'M 135 100 L 148 100 L 148 140 C 144 143 134 141 133 136 Z',
    },
    {
      side: 'back',
      // Right hamstring
      d: 'M 165 100 L 152 100 L 152 140 C 156 143 166 141 167 136 Z',
    },
  ],
};
