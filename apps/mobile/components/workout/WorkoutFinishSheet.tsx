import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SLEEP_FONTS, WORKOUT_THEME, tabularStyle } from '@constants';
import { getExerciseById } from '@lib/workoutFixtures';
import { getTotalSets } from '@lib/workoutAnalytics';
import { detectSessionPRs, type SessionPR } from '@lib/workoutPRs';
import { useWorkoutStore } from '@store/workoutStore';
import type { WorkoutSession } from '@shared';
import type { SessionMetadata, SyncStatus } from '@store/workoutStore';

const PAD_X = 18;
const PRESS_DURATION = 100;
const RPE_DESCRIPTORS = [
  '', 'Easy', 'Easy', 'Light', 'Light', 'Moderate', 'Moderate',
  'Hard', 'Very Hard', 'Brutal', 'Maximal',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationLong(seconds: number | null): string {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatVolume(kg: number): string {
  if (kg >= 10000) return `${(kg / 1000).toFixed(1)}k`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return Math.round(kg).toLocaleString();
}

function smartSessionName(hour: number): string {
  if (hour >= 5 && hour < 9) return 'Morning Lift';
  if (hour >= 9 && hour < 12) return 'Mid-Morning Session';
  if (hour >= 12 && hour < 14) return 'Lunch Lift';
  if (hour >= 14 && hour < 17) return 'Afternoon Lift';
  if (hour >= 17 && hour < 19) return 'Golden Hour Workout';
  if (hour >= 19 && hour < 22) return 'Evening Session';
  return 'Late Night Lift';
}

function sessionVolumeKg(session: WorkoutSession | null): number {
  if (!session) return 0;
  let total = 0;
  for (const ex of session.exercises) {
    for (const set of ex.sets) {
      if (set.weightKg != null && set.reps != null) {
        total += set.weightKg * set.reps;
      }
    }
  }
  return total;
}

function exerciseTopWeight(setsArr: WorkoutSession['exercises'][number]['sets']): number {
  let max = 0;
  for (const s of setsArr) if (s.weightKg != null && s.weightKg > max) max = s.weightKg;
  return max;
}

function exerciseVolume(setsArr: WorkoutSession['exercises'][number]['sets']): number {
  let v = 0;
  for (const s of setsArr) {
    if (s.weightKg != null && s.reps != null) v += s.weightKg * s.reps;
  }
  return v;
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({
  value,
  label,
  delay,
}: {
  value: string;
  label: string;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(280).delay(delay)} style={styles.statCard}>
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
});

const PRPill = memo(function PRPill() {
  return (
    <View style={styles.prPill}>
      <Text style={styles.prPillText}>PR</Text>
    </View>
  );
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkoutFinishSheetProps {
  sheetRef: React.RefObject<BottomSheet | null>;
  session: WorkoutSession | null;
  syncStatus: SyncStatus;
  lastSyncError: string | null;
  onSave: (metadata: SessionMetadata) => Promise<void>;
  onDiscard: () => void;
  onRetry: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WorkoutFinishSheet({
  sheetRef,
  session,
  syncStatus,
  lastSyncError,
  onSave,
  onDiscard,
  onRetry,
}: WorkoutFinishSheetProps) {
  const snapPoints = useMemo(() => ['87%'], []);
  const saveScale = useSharedValue(1);

  // Snapshot the session when the sheet opens so the parent clearing
  // activeSession mid-save doesn't blank out the sheet content.
  const [snapshot, setSnapshot] = useState<WorkoutSession | null>(session);

  const [name, setName] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [discardArmed, setDiscardArmed] = useState(false);

  const isSaving = syncStatus === 'syncing';
  const hasError = syncStatus === 'error';

  // Auto-disarm discard after 5s idle, per design spec
  useEffect(() => {
    if (!discardArmed) return;
    const t = setTimeout(() => setDiscardArmed(false), 5000);
    return () => clearTimeout(t);
  }, [discardArmed]);

  const placeholder = useMemo(() => smartSessionName(new Date().getHours()), []);

  const totalSets = snapshot ? getTotalSets(snapshot) : 0;
  const totalVolumeKg = snapshot ? sessionVolumeKg(snapshot) : 0;

  // Compute PRs against prior sessions (excluding this one).
  const priorSessions = useWorkoutStore((s) => s.sessions);
  const prs: SessionPR[] = useMemo(() => {
    if (!snapshot) return [];
    return detectSessionPRs(snapshot, priorSessions);
  }, [snapshot, priorSessions]);
  const prSet = useMemo(() => new Set(prs.map((p) => p.exerciseId)), [prs]);

  const exerciseRows = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.exercises.map((log) => {
      const fixture = getExerciseById(log.exerciseId);
      const top = exerciseTopWeight(log.sets);
      const vol = exerciseVolume(log.sets);
      return {
        id: log.exerciseId,
        name: fixture?.name ?? log.exerciseId,
        sublabel: `${log.sets.length} ${log.sets.length === 1 ? 'set' : 'sets'}${
          top > 0 ? ` · ${top}kg` : ''
        }`,
        volumeLabel: `${formatVolume(vol)} kg`,
        isPR: prSet.has(log.exerciseId),
      };
    });
  }, [snapshot, prSet]);

  const prSubtitle = useMemo(() => {
    if (prs.length === 0) return '';
    return prs
      .slice(0, 3)
      .map((p) => {
        const fixture = getExerciseById(p.exerciseId);
        const exName = fixture?.name ?? p.exerciseId;
        return `${exName} ${p.weightKg}kg${p.reps ? ` × ${p.reps}` : ''}`;
      })
      .join(' · ');
  }, [prs]);

  const rpeDescriptor = rpe != null ? RPE_DESCRIPTORS[rpe] : '';

  const resetForm = useCallback(() => {
    setName('');
    setRpe(null);
    setNotes('');
    setDiscardArmed(false);
  }, []);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === 0) {
        // Refresh snapshot from current session each time the sheet opens
        setSnapshot(session);
      }
      if (index === -1) resetForm();
    },
    [session, resetForm],
  );

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await onSave({
        name: name.trim() || placeholder,
        // Map 1-10 RPE to 1-4 feelRating so we still hydrate the existing
        // backend column (1=Easy/Light, 2=Moderate, 3=Hard, 4=Maximal).
        feelRating: rpe == null ? null : rpeToFeel(rpe),
        difficultyRating: rpe == null ? null : rpeToDifficulty(rpe),
        notes: notes.trim() || null,
      });
      sheetRef.current?.close();
      resetForm();
    } catch {
      // Parent kept the sheet open; status banner shows the error.
    }
  }, [isSaving, onSave, name, placeholder, rpe, notes, sheetRef, resetForm]);

  const handleDiscard = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDiscard();
    sheetRef.current?.close();
    resetForm();
  }, [onDiscard, sheetRef, resetForm]);

  const handleCancel = useCallback(() => {
    sheetRef.current?.close();
  }, [sheetRef]);

  const saveStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
      onChange={handleSheetChange}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleCancel} hitSlop={10}>
          <Text style={styles.headerCancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Finish workout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {/* Stats trio */}
        <View style={styles.statsRow}>
          <StatCard
            value={formatDurationLong(snapshot?.durationSeconds ?? null)}
            label="Duration"
            delay={60}
          />
          <StatCard value={String(totalSets)} label="Sets" delay={100} />
          <StatCard
            value={`${formatVolume(totalVolumeKg)}`}
            label="kg lifted"
            delay={140}
          />
        </View>

        {/* Workout name */}
        <Animated.View entering={FadeInDown.duration(300).delay(180)} style={styles.section}>
          <Text style={styles.eyebrow}>Workout name</Text>
          <View style={styles.nameField}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={placeholder}
              placeholderTextColor={WORKOUT_THEME.fg3}
              style={styles.nameInput}
              maxLength={60}
              returnKeyType="done"
            />
            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color={WORKOUT_THEME.fg3}
            />
          </View>
          <Text style={styles.nameHelper}>
            {`Leave empty to use “${placeholder}”`}
          </Text>
        </Animated.View>

        {/* PR celebration banner — only when prs.length > 0 */}
        {prs.length > 0 && (
          <Animated.View
            entering={FadeIn.duration(360).delay(220)}
            style={styles.prBannerWrap}>
            <View style={styles.prBanner}>
              <View style={styles.prBannerGlow} />
              <View style={styles.prBannerRow}>
                <View style={styles.prTile}>
                  <MaterialCommunityIcons
                    name="lightning-bolt"
                    size={28}
                    color={WORKOUT_THEME.successInk}
                  />
                </View>
                <View style={styles.prBannerText}>
                  <View style={styles.prBannerHead}>
                    <Text style={styles.prCount}>{prs.length}</Text>
                    <Text style={styles.prTitle}>
                      {prs.length === 1 ? 'new personal record' : 'new personal records'}
                    </Text>
                  </View>
                  {!!prSubtitle && (
                    <Text style={styles.prSubtitle} numberOfLines={2}>
                      {prSubtitle}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* RPE pad */}
        <Animated.View entering={FadeInDown.duration(300).delay(260)} style={styles.section}>
          <View style={styles.rpeHeader}>
            <Text style={styles.eyebrowInline}>How did it feel?</Text>
            {rpe != null && (
              <Text style={styles.rpeValue}>
                RPE {rpe}
                <Text style={styles.rpeDescriptor}>{` · ${rpeDescriptor}`}</Text>
              </Text>
            )}
          </View>
          <View style={styles.rpeRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const active = n === rpe;
              const filled = rpe != null && n < rpe;
              return (
                <Pressable
                  key={n}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRpe(n);
                  }}
                  style={[
                    styles.rpeBtn,
                    filled && styles.rpeBtnFilled,
                    active && styles.rpeBtnActive,
                  ]}>
                  <Text
                    style={[
                      styles.rpeBtnText,
                      filled && styles.rpeBtnTextFilled,
                      active && styles.rpeBtnTextActive,
                    ]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.rpeAnchors}>
            <Text style={styles.rpeAnchorText}>Easy</Text>
            <Text style={styles.rpeAnchorText}>Maximal</Text>
          </View>
        </Animated.View>

        {/* Exercises */}
        {exerciseRows.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300).delay(300)} style={styles.section}>
            <Text style={styles.eyebrow}>Exercises</Text>
            <View style={styles.exerciseCard}>
              {exerciseRows.map((row, i) => (
                <View
                  key={row.id}
                  style={[
                    styles.exerciseRow,
                    i < exerciseRows.length - 1 && styles.exerciseRowDivider,
                  ]}>
                  <View style={styles.exerciseLeft}>
                    <View style={styles.exerciseTitleRow}>
                      <Text style={styles.exerciseName} numberOfLines={1}>
                        {row.name}
                      </Text>
                      {row.isPR && <PRPill />}
                    </View>
                    <Text style={styles.exerciseSub}>{row.sublabel}</Text>
                  </View>
                  <Text style={styles.exerciseVolume}>{row.volumeLabel}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Notes */}
        <Animated.View entering={FadeInDown.duration(300).delay(340)} style={styles.section}>
          <View style={styles.notesHead}>
            <Text style={styles.eyebrowInline}>Notes</Text>
            <Text style={styles.notesCount}>{`${notes.length} / 500`}</Text>
          </View>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="How was the session? Form notes, energy level, anything to remember…"
            placeholderTextColor={WORKOUT_THEME.fg4}
            style={styles.notesInput}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
        </Animated.View>

        {/* Discard — two-step */}
        <Animated.View entering={FadeInDown.duration(300).delay(380)} style={styles.section}>
          {discardArmed ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.discardArmed}>
              <Text style={styles.discardArmedTitle}>
                {`Discard ${totalSets} sets and ${formatDurationLong(
                  snapshot?.durationSeconds ?? null,
                )} of work?`}
              </Text>
              <Text style={styles.discardArmedBody}>
                {`This can’t be undone. Your PRs, volume, and notes will be lost.`}
              </Text>
              <View style={styles.discardArmedRow}>
                <Pressable
                  onPress={() => setDiscardArmed(false)}
                  style={styles.keepBtn}>
                  <Text style={styles.keepBtnText}>Keep editing</Text>
                </Pressable>
                <Pressable onPress={handleDiscard} style={styles.confirmDiscardBtn}>
                  <Text style={styles.confirmDiscardText}>Yes, discard</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setDiscardArmed(true);
                }}
                style={styles.discardIdleBtn}>
                <Text style={styles.discardIdleText}>Discard workout</Text>
              </Pressable>
              <Text style={styles.discardHelper}>
                Tap to confirm. Discarded workouts can’t be recovered.
              </Text>
            </>
          )}
        </Animated.View>

        {/* Bottom spacer so content can scroll above the sticky CTA */}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Sticky save CTA */}
      <View style={styles.ctaWrap} pointerEvents="box-none">
        {(isSaving || hasError) && (
          <Pressable
            onPress={hasError ? onRetry : undefined}
            style={[styles.statusBanner, hasError && styles.statusBannerError]}>
            <MaterialCommunityIcons
              name={hasError ? 'alert-circle-outline' : 'sync'}
              size={14}
              color={hasError ? WORKOUT_THEME.danger : WORKOUT_THEME.fg2}
            />
            <Text
              style={[
                styles.statusBannerText,
                hasError && styles.statusBannerTextError,
              ]}>
              {isSaving
                ? 'Saving…'
                : `Save failed${lastSyncError ? ` — ${lastSyncError}` : ''}. Tap to retry.`}
            </Text>
          </Pressable>
        )}
        <Animated.View style={saveStyle}>
          <Pressable
            disabled={isSaving}
            onPressIn={() => {
              saveScale.value = withTiming(0.97, { duration: PRESS_DURATION });
            }}
            onPressOut={() => {
              saveScale.value = withTiming(1, { duration: PRESS_DURATION });
            }}
            onPress={handleSave}
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}>
            <MaterialCommunityIcons
              name="check"
              size={17}
              color={WORKOUT_THEME.bg}
            />
            <Text style={styles.saveBtnText}>
              {isSaving ? 'Saving…' : 'Save workout'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </BottomSheet>
  );
}

// ─── RPE → backend rating mapping ─────────────────────────────────────────────
// Backend stores feelRating + difficultyRating as 1–4. Map RPE bands so the
// existing column stays useful without expanding the schema.

function rpeToFeel(rpe: number): number {
  if (rpe <= 3) return 4;
  if (rpe <= 5) return 3;
  if (rpe <= 7) return 2;
  return 1;
}

function rpeToDifficulty(rpe: number): number {
  if (rpe <= 2) return 1;
  if (rpe <= 5) return 2;
  if (rpe <= 8) return 3;
  return 4;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: WORKOUT_THEME.surface1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handle: { backgroundColor: WORKOUT_THEME.handleBg, width: 38, height: 5 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD_X,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerCancel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    color: WORKOUT_THEME.fg3,
  },
  headerTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16,
    color: WORKOUT_THEME.fg,
  },
  headerSpacer: { width: 50 },

  scroll: { flex: 1 },
  content: {
    paddingTop: 18,
    paddingBottom: 0,
  },

  section: {
    paddingHorizontal: PAD_X,
    paddingTop: 4,
    paddingBottom: 14,
  },

  // Stats trio
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: PAD_X,
    paddingBottom: 22,
  },
  statCard: {
    flex: 1,
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 4,
  },
  statNum: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: -0.9,
    color: WORKOUT_THEME.fg,
    ...tabularStyle,
  },
  statLabel: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 11.5,
    color: WORKOUT_THEME.fg3,
    marginTop: 4,
  },

  // Eyebrows
  eyebrow: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingLeft: 2,
    marginBottom: 10,
  },
  eyebrowInline: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 10.5,
    color: WORKOUT_THEME.fg3,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    paddingLeft: 2,
  },

  // Workout name
  nameField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: WORKOUT_THEME.surface2,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.border,
  },
  nameInput: {
    flex: 1,
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 16,
    color: WORKOUT_THEME.fg,
    padding: 0,
  },
  nameHelper: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    color: WORKOUT_THEME.fg4,
    marginTop: 6,
    paddingLeft: 4,
  },

  // PR banner
  prBannerWrap: {
    paddingHorizontal: PAD_X,
    paddingTop: 4,
    paddingBottom: 14,
  },
  prBanner: {
    position: 'relative',
    overflow: 'hidden',
    padding: 16,
    borderRadius: 24,
    backgroundColor: WORKOUT_THEME.successBg,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.successBorder,
  },
  prBannerGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.successGlow,
    opacity: 0.6,
  },
  prBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  prTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: WORKOUT_THEME.success,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: WORKOUT_THEME.success,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
  },
  prBannerText: { flex: 1, minWidth: 0 },
  prBannerHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  prCount: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 32,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: WORKOUT_THEME.success,
    ...tabularStyle,
  },
  prTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 17,
    color: WORKOUT_THEME.fg,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  prSubtitle: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12.5,
    color: WORKOUT_THEME.fg2,
    marginTop: 6,
    ...tabularStyle,
  },

  // RPE pad
  rpeHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  rpeValue: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 13,
    color: WORKOUT_THEME.fg,
  },
  rpeDescriptor: {
    fontFamily: SLEEP_FONTS.medium,
    color: WORKOUT_THEME.fg3,
  },
  rpeRow: {
    flexDirection: 'row',
    gap: 5,
  },
  rpeBtn: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: WORKOUT_THEME.overlayWhite05,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rpeBtnFilled: {
    backgroundColor: WORKOUT_THEME.overlayWhite16,
  },
  rpeBtnActive: {
    backgroundColor: WORKOUT_THEME.fg,
  },
  rpeBtnText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16,
    color: WORKOUT_THEME.fg4,
    ...tabularStyle,
  },
  rpeBtnTextFilled: {
    color: WORKOUT_THEME.fg,
  },
  rpeBtnTextActive: {
    color: WORKOUT_THEME.bg,
  },
  rpeAnchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 10,
  },
  rpeAnchorText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 11,
    color: WORKOUT_THEME.fg4,
  },

  // Exercises
  exerciseCard: {
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 22,
    overflow: 'hidden',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  exerciseRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: WORKOUT_THEME.border,
  },
  exerciseLeft: { flex: 1, minWidth: 0 },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  exerciseName: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14.5,
    color: WORKOUT_THEME.fg,
  },
  exerciseSub: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    color: WORKOUT_THEME.fg3,
    marginTop: 3,
    ...tabularStyle,
  },
  exerciseVolume: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    color: WORKOUT_THEME.fg2,
    ...tabularStyle,
  },

  prPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: WORKOUT_THEME.successBg,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.successBorder,
  },
  prPillText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 9.5,
    color: WORKOUT_THEME.success,
    letterSpacing: 0.5,
    lineHeight: 12,
  },

  // Notes
  notesHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  notesCount: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 11,
    color: WORKOUT_THEME.fg4,
    ...tabularStyle,
  },
  notesInput: {
    backgroundColor: WORKOUT_THEME.surface2,
    borderRadius: 18,
    padding: 16,
    minHeight: 80,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    color: WORKOUT_THEME.fg,
    lineHeight: 20,
  },

  // Discard
  discardIdleBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: WORKOUT_THEME.dangerBgSoft,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.dangerBorderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardIdleText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 14,
    color: WORKOUT_THEME.danger,
  },
  discardHelper: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 11,
    color: WORKOUT_THEME.fg4,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    lineHeight: 15,
  },
  discardArmed: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: WORKOUT_THEME.dangerBgSoft,
    borderWidth: 1,
    borderColor: WORKOUT_THEME.dangerBorderHot,
  },
  discardArmedTitle: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 14.5,
    color: WORKOUT_THEME.fg,
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  discardArmedBody: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12.5,
    color: WORKOUT_THEME.fg3,
    marginTop: 4,
    paddingHorizontal: 4,
    lineHeight: 18,
  },
  discardArmedRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  keepBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: WORKOUT_THEME.overlayWhite06,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBtnText: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13.5,
    color: WORKOUT_THEME.fg2,
  },
  confirmDiscardBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: WORKOUT_THEME.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDiscardText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 13.5,
    color: WORKOUT_THEME.fg,
  },

  // Sticky CTA
  ctaWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: PAD_X,
    paddingTop: 12,
    paddingBottom: 22,
    gap: 10,
    backgroundColor: WORKOUT_THEME.surface1,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: WORKOUT_THEME.surface3,
  },
  statusBannerError: {
    backgroundColor: WORKOUT_THEME.dangerBgHot,
  },
  statusBannerText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 12,
    color: WORKOUT_THEME.fg2,
  },
  statusBannerTextError: {
    color: WORKOUT_THEME.danger,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: WORKOUT_THEME.fg,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 15,
    color: WORKOUT_THEME.bg,
  },
});
