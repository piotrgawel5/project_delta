// components/profile/EditProfileModal.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useDialog } from '@components/ui/Dialog';
import { SLEEP_THEME, SLEEP_FONTS, SLEEP_LAYOUT } from '@constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const SHEET_RADIUS = 44;
const SHEET_SPRING = { damping: 32, stiffness: 200, mass: 1.2 };

interface EditProfileModalProps {
  isVisible: boolean;
  onClose: () => void;
}

type EditField = 'username' | 'avatar' | 'weight' | 'height' | 'activity' | 'goal' | 'sports';

export default function EditProfileModal({ isVisible, onClose }: EditProfileModalProps) {
  const user = useAuthStore((s) => s.user);
  const profile = useProfileStore((s) => s.profile);
  const uploadAvatar = useProfileStore((s) => s.uploadAvatar);
  const updateUsername = useProfileStore((s) => s.updateUsername);
  const canChangeUsername = useProfileStore((s) => s.canChangeUsername);
  const checkHasPasskey = useProfileStore((s) => s.checkHasPasskey);
  const deletePasskey = useProfileStore((s) => s.deletePasskey);
  const { showError, showSuccess, showConfirm } = useDialog();
  const insets = useSafeAreaInsets();

  const [activeField, setActiveField] = useState<EditField | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const keyboardOffset = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 420 });
      translateY.value = withSpring(0, SHEET_SPRING);
      if (user) {
        checkHasPasskey(user.id).then(setHasPasskey);
      }

      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const showSub = Keyboard.addListener(showEvent, (e) => {
        keyboardOffset.value = withTiming(-e.endCoordinates.height, { duration: 250 });
      });
      const hideSub = Keyboard.addListener(hideEvent, () => {
        keyboardOffset.value = withTiming(0, { duration: 200 });
      });

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    } else {
      backdropOpacity.value = 0;
      translateY.value = SCREEN_HEIGHT;
      keyboardOffset.value = 0;
      setActiveField(null);
      setNewUsername('');
    }
  }, [isVisible, user]);

  const closeWithAnimation = useCallback(() => {
    Keyboard.dismiss();
    backdropOpacity.value = withTiming(0, { duration: 330 });
    translateY.value = withTiming(
      SCREEN_HEIGHT,
      { duration: 375, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet';
        if (finished) runOnJS(onClose)();
      }
    );
  }, [backdropOpacity, onClose, translateY]);

  const sheetGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      translateY.value = Math.max(0, e.translationY);
      backdropOpacity.value = interpolate(
        translateY.value,
        [0, 300],
        [1, 0],
        Extrapolation.CLAMP
      );
    })
    .onEnd((e) => {
      'worklet';
      if (translateY.value > 120 || e.velocityY > 600) {
        backdropOpacity.value = withTiming(0, { duration: 330 });
        translateY.value = withTiming(
          SCREEN_HEIGHT,
          { duration: 375, easing: Easing.in(Easing.cubic) },
          (finished) => {
            'worklet';
            if (finished) runOnJS(onClose)();
          }
        );
      } else {
        translateY.value = withSpring(0, { damping: 36, stiffness: 220, mass: 0.9 });
        backdropOpacity.value = withTiming(1, { duration: 300 });
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + keyboardOffset.value }],
  }));

  const handlePickAvatar = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      await showError('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0] && user) {
      setLoading(true);
      const uploadResult = await uploadAvatar(user.id, result.assets[0].uri);
      setLoading(false);
      if (uploadResult.success) {
        await showSuccess('Avatar Updated', 'Your profile picture has been updated!');
        closeWithAnimation();
      } else {
        await showError(
          'Upload Failed',
          uploadResult.error ||
            'Failed to upload avatar. Make sure the avatars bucket exists in Supabase Storage.'
        );
      }
    }
  };

  const handleUpdateUsername = async () => {
    if (!newUsername.trim() || !user) return;
    if (!canChangeUsername()) {
      const daysRemaining = profile?.username_changed_at
        ? Math.ceil(
            7 -
              (Date.now() - new Date(profile.username_changed_at).getTime()) /
                (1000 * 60 * 60 * 24)
          )
        : 0;
      await showError(
        'Cannot Change Username',
        `You can change your username again in ${daysRemaining} days.`
      );
      return;
    }
    setLoading(true);
    const result = await updateUsername(user.id, newUsername.trim());
    setLoading(false);
    if (result.success) {
      await showSuccess('Username Updated', 'Your username has been updated!');
      setActiveField(null);
      setNewUsername('');
    } else {
      await showError('Update Failed', result.error || 'Failed to update username');
    }
  };

  const handleDeletePasskey = async () => {
    if (!user) return;
    const confirmed = await showConfirm(
      'Remove Passkey',
      'Are you sure you want to remove your passkey? You will need to use your password or other auth method to sign in.'
    );
    if (confirmed) {
      setLoading(true);
      const result = await deletePasskey(user.id);
      setLoading(false);
      if (result.success) {
        setHasPasskey(false);
        await showSuccess('Passkey Removed', 'Your passkey has been removed.');
      } else {
        await showError('Error', result.error || 'Failed to remove passkey');
      }
    }
  };

  const editOptions = [
    {
      id: 'avatar' as EditField,
      icon: 'camera-outline',
      label: 'Change Profile Photo',
      action: handlePickAvatar,
      enabled: true,
    },
    {
      id: 'username' as EditField,
      icon: 'account-edit-outline',
      label: 'Change Username',
      sublabel: canChangeUsername() ? undefined : 'Available in 7 days',
      action: () => setActiveField('username'),
      enabled: canChangeUsername(),
    },
    {
      id: 'weight' as EditField,
      icon: 'scale-bathroom',
      label: 'Update Weight',
      action: () => {
        /* Navigate to weight edit */
      },
      enabled: true,
    },
    {
      id: 'height' as EditField,
      icon: 'human-male-height',
      label: 'Update Height',
      action: () => {
        /* Navigate to height edit */
      },
      enabled: true,
    },
    {
      id: 'goal' as EditField,
      icon: 'target',
      label: 'Change Goal',
      action: () => {
        /* Navigate to goal edit */
      },
      enabled: true,
    },
  ];

  if (!isVisible) return null;

  return (
    <Modal visible={isVisible} transparent animationType="none" onRequestClose={closeWithAnimation}>
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeWithAnimation}>
          <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
            <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.backdropOverlay} />
          </Animated.View>
        </Pressable>

        {/* Sheet */}
        <GestureDetector gesture={sheetGesture}>
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + 24 }, sheetStyle]}>
            {/* Handle */}
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              {activeField === 'username' ? (
                <Pressable style={styles.backButton} onPress={() => setActiveField(null)}>
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={24}
                    color={SLEEP_THEME.textSecondary}
                  />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>
              ) : (
                <Text style={styles.title}>Edit Profile</Text>
              )}
              <Pressable style={styles.closeButton} onPress={closeWithAnimation}>
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={SLEEP_THEME.textSecondary}
                />
              </Pressable>
            </View>

            {/* Loading overlay */}
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={SLEEP_THEME.textPrimary} />
              </View>
            )}

            {/* Username Edit View */}
            {activeField === 'username' ? (
              <View style={styles.editView}>
                <Text style={styles.inputLabel}>New Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter new username"
                  placeholderTextColor={SLEEP_THEME.textDisabled}
                  value={newUsername}
                  onChangeText={setNewUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  autoFocus
                />
                <Text style={styles.inputHint}>
                  You can only change your username once per week.
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    (!newUsername.trim() || loading) && styles.saveButtonDisabled,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleUpdateUsername}
                  disabled={!newUsername.trim() || loading}>
                  <Text
                    style={[
                      styles.saveButtonText,
                      (!newUsername.trim() || loading) && styles.saveButtonTextDisabled,
                    ]}>
                    Save Username
                  </Text>
                </Pressable>
              </View>
            ) : (
              /* Options List */
              <View style={styles.optionsList}>
                {editOptions.map((option) => (
                  <Pressable
                    key={option.id}
                    style={({ pressed }) => [
                      styles.optionItem,
                      !option.enabled && styles.optionItemDisabled,
                      pressed && option.enabled && styles.optionItemPressed,
                    ]}
                    onPress={option.action}
                    disabled={!option.enabled}>
                    <View
                      style={[
                        styles.optionIcon,
                        !option.enabled && styles.optionIconDisabled,
                      ]}>
                      <MaterialCommunityIcons
                        name={option.icon as any}
                        size={22}
                        color={option.enabled ? SLEEP_THEME.textPrimary : SLEEP_THEME.textDisabled}
                      />
                    </View>
                    <View style={styles.optionContent}>
                      <Text
                        style={[
                          styles.optionLabel,
                          !option.enabled && styles.optionLabelDisabled,
                        ]}>
                        {option.label}
                      </Text>
                      {option.sublabel && (
                        <Text style={styles.optionSublabel}>{option.sublabel}</Text>
                      )}
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color={option.enabled ? SLEEP_THEME.textDisabled : 'rgba(255,255,255,0.15)'}
                    />
                  </Pressable>
                ))}

                {/* Passkey Removal */}
                {hasPasskey && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.optionItem,
                      styles.dangerOption,
                      pressed && styles.optionItemPressed,
                    ]}
                    onPress={handleDeletePasskey}>
                    <View style={[styles.optionIcon, styles.dangerIcon]}>
                      <MaterialCommunityIcons
                        name="fingerprint-off"
                        size={22}
                        color={SLEEP_THEME.danger}
                      />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionLabel, styles.dangerLabel]}>Remove Passkey</Text>
                      <Text style={styles.optionSublabel}>Disable biometric login</Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color="rgba(255,69,58,0.4)"
                    />
                  </Pressable>
                )}
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SLEEP_THEME.bottomSheetBg,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: SLEEP_LAYOUT.cardPadding,
    paddingTop: 12,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: SLEEP_THEME.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontFamily: SLEEP_FONTS.bold,
    color: SLEEP_THEME.textPrimary,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textSecondary,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SLEEP_THEME.elevatedBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: SHEET_RADIUS,
    zIndex: 100,
  },
  optionsList: {
    gap: 8,
    paddingBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    padding: 14,
    gap: 14,
  },
  optionItemDisabled: {
    opacity: 0.45,
  },
  optionItemPressed: {
    opacity: 0.7,
  },
  dangerOption: {
    marginTop: 8,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: SLEEP_THEME.elevatedBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconDisabled: {
    backgroundColor: SLEEP_THEME.elevatedBg,
    opacity: 0.5,
  },
  dangerIcon: {
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textPrimary,
  },
  optionLabelDisabled: {
    color: SLEEP_THEME.textDisabled,
  },
  dangerLabel: {
    color: SLEEP_THEME.danger,
  },
  optionSublabel: {
    fontSize: 12,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textDisabled,
    marginTop: 2,
  },
  editView: {
    gap: 14,
    paddingBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textMuted1,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textPrimary,
  },
  inputHint: {
    fontSize: 12,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textDisabled,
  },
  saveButton: {
    backgroundColor: SLEEP_THEME.textPrimary,
    height: 56,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonDisabled: {
    backgroundColor: SLEEP_THEME.elevatedBg,
  },
  saveButtonText: {
    fontSize: 15,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.screenBg,
  },
  saveButtonTextDisabled: {
    color: SLEEP_THEME.textMuted2,
  },
});
