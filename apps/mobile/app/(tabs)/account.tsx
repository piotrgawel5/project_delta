// app/(tabs)/account.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useDialog } from '@components/ui/Dialog';
import EditProfileModal from '@components/profile/EditProfileModal';
import Constants from 'expo-constants';
import { SLEEP_THEME, SLEEP_LAYOUT, SLEEP_FONTS } from '@constants';

const APP_VERSION = Constants.expoConfig?.version || '0.1';

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const createAccountWithPasskey = useAuthStore((s) => s.createAccountWithPasskey);
  const authLoading = useAuthStore((s) => s.loading);

  const profile = useProfileStore((s) => s.profile);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const updateAuthMethod = useProfileStore((s) => s.updateAuthMethod);
  const checkHasPasskey = useProfileStore((s) => s.checkHasPasskey);
  const profileLoading = useProfileStore((s) => s.loading);

  const { showConfirm, showSuccess, showError } = useDialog();

  const [showEditModal, setShowEditModal] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [checkingPasskey, setCheckingPasskey] = useState(true);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    fetchProfile(user.id);
    checkHasPasskey(user.id).then((result: boolean) => {
      if (isMounted) {
        setHasPasskey(result);
        setCheckingPasskey(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user, fetchProfile, checkHasPasskey]);

  const loading = authLoading || profileLoading;
  const authMethod = profile?.primary_auth_method || 'password';

  const handleSignOut = async () => {
    const confirmed = await showConfirm('Sign Out', 'Are you sure you want to sign out?');
    if (confirmed) {
      await signOut();
      router.replace('/');
    }
  };

  const handleAddPasskey = async () => {
    if (!user?.email) {
      await showError('Error', 'No email associated with this account');
      return;
    }
    const result = await createAccountWithPasskey(user.email);
    if (result.success) {
      await updateAuthMethod(user.id, profile?.primary_auth_method || 'password', true);
      setHasPasskey(true);
      await showSuccess('Passkey Added', 'You can now use biometric login!');
    } else {
      await showError('Error', result.error || 'Failed to add passkey');
    }
  };

  const handleEditPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowEditModal(true);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const calculateAge = (dob: string) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getAuthMethodLabel = () => {
    switch (authMethod) {
      case 'google':
        return 'Google';
      case 'passkey':
        return 'Passkey';
      default:
        return 'Email';
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SLEEP_THEME.success} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header with Avatar */}
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={[SLEEP_THEME.success, '#22C55E']}
                style={styles.avatarGradient}>
                <Text style={styles.avatarText}>
                  {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </Text>
              </LinearGradient>
            )}
          </View>

          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.username}>
            {profile?.username || user?.email?.split('@')[0] || 'User'}
          </Text>

          {/* Quick Stats */}
          {profile?.date_of_birth && (
            <View style={styles.quickStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{calculateAge(profile.date_of_birth)}</Text>
                <Text style={styles.statLabel}>Age</Text>
              </View>
              {profile?.weight_value && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{profile.weight_value}</Text>
                    <Text style={styles.statLabel}>{profile.weight_unit || 'kg'}</Text>
                  </View>
                </>
              )}
              {profile?.height_value && (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {profile.height_unit === 'ft'
                        ? `${profile.height_value}'${profile.height_inches || 0}"`
                        : profile.height_value}
                    </Text>
                    <Text style={styles.statLabel}>
                      {profile.height_unit === 'ft' ? 'ft' : 'cm'}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* Edit Profile Link */}
        <Pressable style={styles.editLink} onPress={handleEditPress}>
          <Text style={styles.editLinkText}>edit profile</Text>
        </Pressable>

        {/* Cards */}
        <View style={styles.cardStack}>
          {/* Profile Details Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(220)} style={styles.card}>
            <Text style={styles.sectionTitle}>PROFILE DETAILS</Text>

            {profile?.goal && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Goal</Text>
                <Text style={styles.detailValue}>
                  {profile.goal
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Text>
              </View>
            )}

            {profile?.activity_level && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Activity Level</Text>
                <Text style={styles.detailValue}>
                  {profile.activity_level
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Text>
              </View>
            )}

            {profile?.preferred_sport && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Sports</Text>
                <Text style={styles.detailValue}>
                  {profile.preferred_sport
                    .split(',')
                    .map((s: string) =>
                      s.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                    )
                    .join(', ')}
                </Text>
              </View>
            )}

            {!profile?.goal && !profile?.activity_level && !profile?.preferred_sport && (
              <Text style={styles.emptyNote}>No profile details set.</Text>
            )}
          </Animated.View>

          {/* Security Card */}
          <Animated.View entering={FadeInDown.duration(400).delay(270)} style={styles.card}>
            <Text style={styles.sectionTitle}>SECURITY</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Auth Method</Text>
              <View style={styles.authBadge}>
                <Text style={styles.authBadgeText}>{getAuthMethodLabel()}</Text>
              </View>
            </View>

            {!checkingPasskey && hasPasskey && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Passkey</Text>
                <View style={[styles.authBadge, styles.authBadgeActive]}>
                  <MaterialCommunityIcons
                    name="fingerprint"
                    size={14}
                    color={SLEEP_THEME.success}
                  />
                  <Text style={[styles.authBadgeText, styles.authBadgeTextActive]}>Enabled</Text>
                </View>
              </View>
            )}

            {!checkingPasskey && !hasPasskey && (
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                ]}
                onPress={handleAddPasskey}>
                <View style={styles.actionIconContainer}>
                  <MaterialCommunityIcons
                    name="fingerprint"
                    size={22}
                    color={SLEEP_THEME.success}
                  />
                </View>
                <View style={styles.actionContent}>
                  <Text style={styles.actionTitle}>Add Passkey</Text>
                  <Text style={styles.actionDescription}>Enable biometric login</Text>
                </View>
                <MaterialCommunityIcons name="plus" size={24} color={SLEEP_THEME.success} />
              </Pressable>
            )}

            {/* Health Services Management */}
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.actionButtonPressed,
              ]}
              onPress={async () => {
                try {
                  const { openHealthConnectSettings } = await import(
                    '../../modules/health-connect'
                  );
                  await openHealthConnectSettings();
                } catch (error) {
                  console.error('Error opening Health Connect:', error);
                }
              }}>
              <View style={[styles.actionIconContainer, styles.actionIconHealth]}>
                <MaterialCommunityIcons
                  name="heart-pulse"
                  size={22}
                  color={SLEEP_THEME.colorREM}
                />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Health Services</Text>
                <Text style={styles.actionDescription}>Manage Health Connect permissions</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={SLEEP_THEME.textDisabled}
              />
            </Pressable>
          </Animated.View>
        </View>

        {/* Sign Out */}
        <Animated.View entering={FadeInDown.duration(400).delay(320)}>
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
            onPress={handleSignOut}>
            <MaterialCommunityIcons name="logout" size={20} color={SLEEP_THEME.danger} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </Animated.View>

        <Text style={styles.version}>Delta v{APP_VERSION}</Text>
      </ScrollView>

      <EditProfileModal
        isVisible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          if (user) {
            checkHasPasskey(user.id).then(setHasPasskey);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SLEEP_THEME.screenBg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: SLEEP_THEME.screenBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingBottom: SLEEP_LAYOUT.scrollBottomPad,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 38,
    fontFamily: SLEEP_FONTS.bold,
    color: SLEEP_THEME.screenBg,
  },
  greeting: {
    fontSize: 13,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textMuted1,
  },
  username: {
    fontSize: 28,
    fontFamily: SLEEP_FONTS.bold,
    color: SLEEP_THEME.textPrimary,
    marginTop: 4,
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 22,
    fontFamily: SLEEP_FONTS.bold,
    color: SLEEP_THEME.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textMuted1,
    letterSpacing: 0.7,
    marginTop: 3,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  editLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  editLinkText: {
    color: SLEEP_THEME.textDisabled,
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  cardStack: {
    gap: SLEEP_LAYOUT.cardGap,
  },
  card: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: SLEEP_LAYOUT.cardPadding,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textMuted1,
    letterSpacing: 0.7,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textPrimary,
    maxWidth: '60%',
    textAlign: 'right',
  },
  emptyNote: {
    fontSize: 13,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textDisabled,
    paddingVertical: 8,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: SLEEP_THEME.elevatedBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  authBadgeActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  authBadgeText: {
    fontSize: 12,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textSecondary,
  },
  authBadgeTextActive: {
    color: SLEEP_THEME.success,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    gap: 12,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: SLEEP_LAYOUT.cardRadiusInner,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconHealth: {
    backgroundColor: 'rgba(94, 92, 230, 0.15)',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.textPrimary,
  },
  actionDescription: {
    fontSize: 12,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textDisabled,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    height: 56,
    marginTop: 8,
  },
  signOutButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  signOutText: {
    fontSize: 15,
    fontFamily: SLEEP_FONTS.semiBold,
    color: SLEEP_THEME.danger,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    fontFamily: SLEEP_FONTS.regular,
    color: SLEEP_THEME.textDisabled,
    marginTop: 24,
  },
});
