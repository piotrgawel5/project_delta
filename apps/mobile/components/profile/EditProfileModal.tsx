// components/profile/EditProfileModal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
  Easing,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useDialog } from '@components/ui/Dialog';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

type EditField = 'username' | 'avatar' | 'weight' | 'height' | 'activity' | 'goal' | 'sports';

export default function EditProfileModal({ visible, onClose }: EditProfileModalProps) {
  const { user } = useAuthStore();
  const {
    profile,
    uploadAvatar,
    updateUsername,
    canChangeUsername,
    checkHasPasskey,
    deletePasskey,
    fetchProfile,
  } = useProfileStore();
  const { showError, showSuccess, showConfirm } = useDialog();

  const [activeField, setActiveField] = useState<EditField | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);

  // Animation
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 15,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Check passkey status
      if (user) {
        checkHasPasskey(user.id).then(setHasPasskey);
      }
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
      setActiveField(null);
    }
  }, [visible, user]);

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
        onClose();
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
              (Date.now() - new Date(profile.username_changed_at).getTime()) / (1000 * 60 * 60 * 24)
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

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <BlurView intensity={30} tint="dark" style={styles.blurOverlay}>
          <Pressable style={styles.backdropPress} onPress={onClose} />

          <Animated.View
            style={[
              styles.modalContainer,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}>
            <LinearGradient
              colors={['rgba(40, 40, 45, 0.98)', 'rgba(28, 28, 30, 0.98)']}
              style={styles.modal}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Edit Profile</Text>
                <Pressable style={styles.closeButton} onPress={onClose}>
                  <MaterialCommunityIcons name="close" size={24} color="rgba(255,255,255,0.6)" />
                </Pressable>
              </View>

              {/* Loading overlay */}
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color={ACCENT} />
                </View>
              )}

              {/* Username Edit View */}
              {activeField === 'username' ? (
                <View style={styles.editView}>
                  <Pressable style={styles.backButton} onPress={() => setActiveField(null)}>
                    <MaterialCommunityIcons
                      name="arrow-left"
                      size={24}
                      color="rgba(255,255,255,0.6)"
                    />
                    <Text style={styles.backText}>Back</Text>
                  </Pressable>

                  <Text style={styles.editLabel}>New Username</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new username"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={newUsername}
                    onChangeText={setNewUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={20}
                  />
                  <Text style={styles.inputHint}>
                    You can only change your username once per week.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.saveButton,
                      (!newUsername.trim() || loading) && styles.saveButtonDisabled,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={handleUpdateUsername}
                    disabled={!newUsername.trim() || loading}>
                    <Text style={styles.saveButtonText}>Save Username</Text>
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
                        style={[styles.optionIcon, !option.enabled && styles.optionIconDisabled]}>
                        <MaterialCommunityIcons
                          name={option.icon as any}
                          size={22}
                          color={option.enabled ? ACCENT : 'rgba(255,255,255,0.3)'}
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
                        color={option.enabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}
                      />
                    </Pressable>
                  ))}

                  {/* Passkey Management */}
                  {hasPasskey && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.optionItem,
                        styles.dangerOption,
                        pressed && styles.optionItemPressed,
                      ]}
                      onPress={handleDeletePasskey}>
                      <View style={[styles.optionIcon, styles.dangerIcon]}>
                        <MaterialCommunityIcons name="fingerprint-off" size={22} color="#FF453A" />
                      </View>
                      <View style={styles.optionContent}>
                        <Text style={[styles.optionLabel, styles.dangerLabel]}>Remove Passkey</Text>
                        <Text style={styles.optionSublabel}>Disable biometric login</Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={22}
                        color="rgba(255,69,58,0.5)"
                      />
                    </Pressable>
                  )}
                </View>
              )}
            </LinearGradient>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '80%',
  },
  modal: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 28,
    zIndex: 100,
  },
  optionsList: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  optionItemDisabled: {
    opacity: 0.5,
  },
  optionItemPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dangerOption: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.2)',
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionIconDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dangerIcon: {
    backgroundColor: 'rgba(255,69,58,0.15)',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  optionLabelDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  dangerLabel: {
    color: '#FF453A',
  },
  optionSublabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  editView: {
    gap: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
  },
  editLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    fontFamily: 'Inter-Regular',
  },
  inputHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Inter-Regular',
  },
  saveButton: {
    backgroundColor: ACCENT,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(48, 209, 88, 0.3)',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Inter-SemiBold',
  },
});
