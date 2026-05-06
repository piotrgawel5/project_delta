import type { Equipment, Exercise } from "@shared";

export const EXERCISES: Exercise[] = [
  // ── CHEST ──────────────────────────────────────────────────────────────────
  {
    id: "barbell_bench_press",
    name: "Barbell Bench Press",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts", "triceps"],
  },
  {
    id: "dumbbell_bench_press",
    name: "Dumbbell Bench Press",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts", "triceps"],
  },
  {
    id: "incline_barbell_press",
    name: "Incline Barbell Press",
    category: "chest",
    primaryMuscles: ["chest", "front_delts"],
    secondaryMuscles: ["triceps"],
  },
  {
    id: "incline_dumbbell_press",
    name: "Incline Dumbbell Press",
    category: "chest",
    primaryMuscles: ["chest", "front_delts"],
    secondaryMuscles: ["triceps"],
  },
  {
    id: "cable_fly",
    name: "Cable Fly",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts"],
  },
  {
    id: "dumbbell_fly",
    name: "Dumbbell Fly",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts"],
  },
  {
    id: "chest_dip",
    name: "Chest Dip",
    category: "chest",
    primaryMuscles: ["chest", "triceps"],
    secondaryMuscles: ["front_delts"],
  },
  {
    id: "pushup",
    name: "Push-Up",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts", "triceps"],
  },
  {
    id: "machine_chest_press",
    name: "Machine Chest Press",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts", "triceps"],
  },
  {
    id: "pec_deck",
    name: "Pec Deck",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
  },

  // ── BACK ───────────────────────────────────────────────────────────────────
  {
    id: "deadlift",
    name: "Deadlift",
    category: "back",
    primaryMuscles: ["lower_back", "glutes", "hamstrings"],
    secondaryMuscles: ["traps", "lats", "upper_back", "forearms"],
  },
  {
    id: "barbell_row",
    name: "Barbell Row",
    category: "back",
    primaryMuscles: ["lats", "upper_back"],
    secondaryMuscles: ["rear_delts", "biceps", "lower_back"],
  },
  {
    id: "dumbbell_row",
    name: "Dumbbell Row",
    category: "back",
    primaryMuscles: ["lats", "upper_back"],
    secondaryMuscles: ["rear_delts", "biceps"],
  },
  {
    id: "pullup",
    name: "Pull-Up",
    category: "back",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["upper_back", "biceps", "rear_delts"],
  },
  {
    id: "lat_pulldown",
    name: "Lat Pulldown",
    category: "back",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["upper_back", "biceps"],
  },
  {
    id: "seated_cable_row",
    name: "Seated Cable Row",
    category: "back",
    primaryMuscles: ["upper_back", "lats"],
    secondaryMuscles: ["rear_delts", "biceps"],
  },
  {
    id: "face_pull",
    name: "Face Pull",
    category: "back",
    primaryMuscles: ["rear_delts", "upper_back"],
    secondaryMuscles: ["traps"],
  },
  {
    id: "shrug",
    name: "Barbell Shrug",
    category: "back",
    primaryMuscles: ["traps"],
    secondaryMuscles: ["upper_back"],
  },
  {
    id: "hyperextension",
    name: "Hyperextension",
    category: "back",
    primaryMuscles: ["lower_back", "glutes"],
    secondaryMuscles: ["hamstrings"],
  },
  {
    id: "t_bar_row",
    name: "T-Bar Row",
    category: "back",
    primaryMuscles: ["upper_back", "lats"],
    secondaryMuscles: ["rear_delts", "biceps"],
  },

  // ── SHOULDERS ──────────────────────────────────────────────────────────────
  {
    id: "barbell_ohp",
    name: "Barbell Overhead Press",
    category: "shoulders",
    primaryMuscles: ["front_delts", "side_delts"],
    secondaryMuscles: ["triceps", "traps"],
  },
  {
    id: "dumbbell_ohp",
    name: "Dumbbell Overhead Press",
    category: "shoulders",
    primaryMuscles: ["front_delts", "side_delts"],
    secondaryMuscles: ["triceps"],
  },
  {
    id: "lateral_raise",
    name: "Lateral Raise",
    category: "shoulders",
    primaryMuscles: ["side_delts"],
    secondaryMuscles: ["traps"],
  },
  {
    id: "front_raise",
    name: "Front Raise",
    category: "shoulders",
    primaryMuscles: ["front_delts"],
    secondaryMuscles: ["side_delts"],
  },
  {
    id: "reverse_fly",
    name: "Reverse Fly",
    category: "shoulders",
    primaryMuscles: ["rear_delts"],
    secondaryMuscles: ["upper_back", "traps"],
  },
  {
    id: "cable_lateral_raise",
    name: "Cable Lateral Raise",
    category: "shoulders",
    primaryMuscles: ["side_delts"],
    secondaryMuscles: [],
  },
  {
    id: "arnold_press",
    name: "Arnold Press",
    category: "shoulders",
    primaryMuscles: ["front_delts", "side_delts"],
    secondaryMuscles: ["triceps", "rear_delts"],
  },
  {
    id: "upright_row",
    name: "Upright Row",
    category: "shoulders",
    primaryMuscles: ["side_delts", "traps"],
    secondaryMuscles: ["front_delts", "biceps"],
  },

  // ── ARMS ───────────────────────────────────────────────────────────────────
  {
    id: "barbell_curl",
    name: "Barbell Curl",
    category: "arms",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
  },
  {
    id: "dumbbell_curl",
    name: "Dumbbell Curl",
    category: "arms",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
  },
  {
    id: "hammer_curl",
    name: "Hammer Curl",
    category: "arms",
    primaryMuscles: ["biceps", "forearms"],
    secondaryMuscles: [],
  },
  {
    id: "preacher_curl",
    name: "Preacher Curl",
    category: "arms",
    primaryMuscles: ["biceps"],
    secondaryMuscles: [],
  },
  {
    id: "cable_curl",
    name: "Cable Curl",
    category: "arms",
    primaryMuscles: ["biceps"],
    secondaryMuscles: ["forearms"],
  },
  {
    id: "tricep_pushdown",
    name: "Tricep Pushdown",
    category: "arms",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
  },
  {
    id: "skull_crusher",
    name: "Skull Crusher",
    category: "arms",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
  },
  {
    id: "overhead_tricep_ext",
    name: "Overhead Tricep Extension",
    category: "arms",
    primaryMuscles: ["triceps"],
    secondaryMuscles: [],
  },
  {
    id: "tricep_dip",
    name: "Tricep Dip",
    category: "arms",
    primaryMuscles: ["triceps"],
    secondaryMuscles: ["chest", "front_delts"],
  },
  {
    id: "wrist_curl",
    name: "Wrist Curl",
    category: "arms",
    primaryMuscles: ["forearms"],
    secondaryMuscles: [],
  },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  {
    id: "barbell_squat",
    name: "Barbell Squat",
    category: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "lower_back", "calves"],
  },
  {
    id: "front_squat",
    name: "Front Squat",
    category: "legs",
    primaryMuscles: ["quads"],
    secondaryMuscles: ["glutes", "upper_back"],
  },
  {
    id: "leg_press",
    name: "Leg Press",
    category: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings"],
  },
  {
    id: "romanian_deadlift",
    name: "Romanian Deadlift",
    category: "legs",
    primaryMuscles: ["hamstrings", "glutes"],
    secondaryMuscles: ["lower_back"],
  },
  {
    id: "leg_curl",
    name: "Leg Curl",
    category: "legs",
    primaryMuscles: ["hamstrings"],
    secondaryMuscles: ["calves"],
  },
  {
    id: "leg_extension",
    name: "Leg Extension",
    category: "legs",
    primaryMuscles: ["quads"],
    secondaryMuscles: [],
  },
  {
    id: "lunge",
    name: "Lunge",
    category: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "hip_flexors"],
  },
  {
    id: "bulgarian_split_squat",
    name: "Bulgarian Split Squat",
    category: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "hip_flexors"],
  },
  {
    id: "hip_thrust",
    name: "Hip Thrust",
    category: "legs",
    primaryMuscles: ["glutes"],
    secondaryMuscles: ["hamstrings"],
  },
  {
    id: "calf_raise",
    name: "Calf Raise",
    category: "legs",
    primaryMuscles: ["calves"],
    secondaryMuscles: [],
  },
  {
    id: "sumo_deadlift",
    name: "Sumo Deadlift",
    category: "legs",
    primaryMuscles: ["glutes", "hamstrings", "quads"],
    secondaryMuscles: ["lower_back", "traps"],
  },
  {
    id: "goblet_squat",
    name: "Goblet Squat",
    category: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["upper_back"],
  },

  // ── CORE ───────────────────────────────────────────────────────────────────
  {
    id: "crunch",
    name: "Crunch",
    category: "core",
    primaryMuscles: ["abs"],
    secondaryMuscles: [],
  },
  {
    id: "plank",
    name: "Plank",
    category: "core",
    primaryMuscles: ["abs"],
    secondaryMuscles: ["obliques", "lower_back"],
  },
  {
    id: "cable_crunch",
    name: "Cable Crunch",
    category: "core",
    primaryMuscles: ["abs"],
    secondaryMuscles: [],
  },
  {
    id: "hanging_leg_raise",
    name: "Hanging Leg Raise",
    category: "core",
    primaryMuscles: ["abs", "hip_flexors"],
    secondaryMuscles: ["obliques"],
  },
  {
    id: "russian_twist",
    name: "Russian Twist",
    category: "core",
    primaryMuscles: ["obliques"],
    secondaryMuscles: ["abs"],
  },
  {
    id: "ab_rollout",
    name: "Ab Rollout",
    category: "core",
    primaryMuscles: ["abs"],
    secondaryMuscles: ["lower_back", "lats"],
  },
  {
    id: "side_plank",
    name: "Side Plank",
    category: "core",
    primaryMuscles: ["obliques"],
    secondaryMuscles: ["abs"],
  },
  {
    id: "dead_bug",
    name: "Dead Bug",
    category: "core",
    primaryMuscles: ["abs"],
    secondaryMuscles: ["hip_flexors"],
  },

  // ── CARDIO ─────────────────────────────────────────────────────────────────
  {
    id: "treadmill_run",
    name: "Treadmill Run",
    category: "cardio",
    primaryMuscles: ["quads", "hamstrings", "calves"],
    secondaryMuscles: ["hip_flexors", "glutes"],
  },
  {
    id: "cycling",
    name: "Cycling",
    category: "cardio",
    primaryMuscles: ["quads", "hamstrings"],
    secondaryMuscles: ["calves", "glutes"],
  },
  {
    id: "rowing_machine",
    name: "Rowing Machine",
    category: "cardio",
    primaryMuscles: ["lats", "upper_back", "quads"],
    secondaryMuscles: ["biceps", "rear_delts", "hamstrings"],
  },
  {
    id: "jump_rope",
    name: "Jump Rope",
    category: "cardio",
    primaryMuscles: ["calves"],
    secondaryMuscles: ["quads", "side_delts"],
  },
  {
    id: "stair_climber",
    name: "Stair Climber",
    category: "cardio",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["calves", "hamstrings"],
  },

  // ── FULL BODY ───────────────────────────────────────────────────────────────
  {
    id: "clean_and_press",
    name: "Clean and Press",
    category: "full_body",
    primaryMuscles: ["quads", "glutes", "front_delts", "traps"],
    secondaryMuscles: ["hamstrings", "lower_back", "triceps"],
  },
  {
    id: "thruster",
    name: "Thruster",
    category: "full_body",
    primaryMuscles: ["quads", "glutes", "front_delts"],
    secondaryMuscles: ["triceps", "upper_back"],
  },
  {
    id: "burpee",
    name: "Burpee",
    category: "full_body",
    primaryMuscles: ["chest", "quads", "glutes"],
    secondaryMuscles: ["triceps", "abs", "calves"],
  },
  {
    id: "kettlebell_swing",
    name: "Kettlebell Swing",
    category: "full_body",
    primaryMuscles: ["glutes", "hamstrings"],
    secondaryMuscles: ["lower_back", "upper_back", "abs"],
  },
  {
    id: "farmers_carry",
    name: "Farmer's Carry",
    category: "full_body",
    primaryMuscles: ["forearms", "traps"],
    secondaryMuscles: ["abs", "quads", "glutes"],
  },

  // ── BODYWEIGHT PROGRESSIONS (T2.1) ────────────────────────────────────────
  {
    id: "push_up",
    name: "Push-Up",
    category: "chest",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["front_delts", "triceps"],
    equipment: "bodyweight",
  },
  {
    id: "diamond_push_up",
    name: "Diamond Push-Up",
    category: "chest",
    primaryMuscles: ["triceps"],
    secondaryMuscles: ["chest", "front_delts"],
    equipment: "bodyweight",
  },
  {
    id: "decline_push_up",
    name: "Decline Push-Up",
    category: "chest",
    primaryMuscles: ["chest", "front_delts"],
    secondaryMuscles: ["triceps"],
    equipment: "bodyweight",
  },
  {
    id: "pike_push_up",
    name: "Pike Push-Up",
    category: "shoulders",
    primaryMuscles: ["front_delts"],
    secondaryMuscles: ["triceps", "side_delts"],
    equipment: "bodyweight",
  },
  {
    id: "pull_up",
    name: "Pull-Up",
    category: "back",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "upper_back"],
    equipment: "bodyweight",
  },
  {
    id: "chin_up",
    name: "Chin-Up",
    category: "back",
    primaryMuscles: ["lats", "biceps"],
    secondaryMuscles: ["upper_back"],
    equipment: "bodyweight",
  },
  {
    id: "inverted_row",
    name: "Inverted Row",
    category: "back",
    primaryMuscles: ["upper_back"],
    secondaryMuscles: ["lats", "biceps"],
    equipment: "bodyweight",
  },
  {
    id: "dip",
    name: "Bodyweight Dip",
    category: "chest",
    primaryMuscles: ["triceps", "chest"],
    secondaryMuscles: ["front_delts"],
    equipment: "bodyweight",
  },
  {
    id: "pistol_squat",
    name: "Pistol Squat",
    category: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings", "calves"],
    equipment: "bodyweight",
  },
  {
    id: "bulgarian_split_squat_bw",
    name: "Bulgarian Split Squat (BW)",
    category: "legs",
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings"],
    equipment: "bodyweight",
  },
  {
    id: "hanging_leg_raise",
    name: "Hanging Leg Raise",
    category: "core",
    primaryMuscles: ["abs", "hip_flexors"],
    secondaryMuscles: ["forearms"],
    equipment: "bodyweight",
  },
  {
    id: "plank",
    name: "Plank",
    category: "core",
    primaryMuscles: ["abs"],
    secondaryMuscles: ["obliques", "lower_back"],
    equipment: "bodyweight",
  },
];

export const EXERCISE_CATEGORIES: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "legs", label: "Legs" },
  { id: "core", label: "Core" },
  { id: "cardio", label: "Cardio" },
  { id: "full_body", label: "Full Body" },
];

export function getExerciseById(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

export function getExercisesByCategory(category: string): Exercise[] {
  if (category === "all") return EXERCISES;
  return EXERCISES.filter((e) => e.category === category);
}

/**
 * Resolves the equipment for an exercise. Uses the explicit `equipment` field
 * when present; otherwise infers from the id naming convention so the existing
 * 68-entry library doesn't need to be hand-tagged.
 */
export function getExerciseEquipment(exercise: Exercise): Equipment {
  if (exercise.equipment) return exercise.equipment;
  const id = exercise.id.toLowerCase();
  if (id.includes("barbell")) return "barbell";
  if (id.includes("dumbbell") || id === "farmers_carry") return "dumbbell";
  if (id.includes("cable")) return "cable";
  if (id.includes("machine") || id.includes("press_machine") || id.includes("smith")) return "machine";
  if (id.includes("kettlebell") || id.includes("kb_")) return "kettlebell";
  if (id.includes("band")) return "bands";
  // The remaining originals (e.g. squats, deadlifts) overwhelmingly use a bar.
  return "barbell";
}

export function filterExercisesByEquipment(
  exercises: Exercise[],
  allowed: Equipment[],
): Exercise[] {
  if (allowed.length === 0) return exercises;
  const allowedSet = new Set(allowed);
  return exercises.filter((e) => allowedSet.has(getExerciseEquipment(e)));
}

/**
 * Find a substitute that hits the same primary muscles but with allowed
 * equipment. Returns null when no swap is possible.
 */
export function findSubstitute(
  exerciseId: string,
  allowed: Equipment[],
): Exercise | null {
  const original = getExerciseById(exerciseId);
  if (!original) return null;
  if (allowed.length === 0) return original;
  if (allowed.includes(getExerciseEquipment(original))) return original;

  const allowedSet = new Set(allowed);
  const primaryKey = original.primaryMuscles.slice().sort().join("|");

  return (
    EXERCISES.find((e) => {
      if (e.id === exerciseId) return false;
      if (!allowedSet.has(getExerciseEquipment(e))) return false;
      return e.primaryMuscles.slice().sort().join("|") === primaryKey;
    }) ?? null
  );
}
