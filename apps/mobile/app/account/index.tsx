// app/account/index.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useDialog } from '@components/ui/Dialog';
import EditProfileModal from '@components/profile/EditProfileModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

export default function AccountScreen() {
  const { user, session, signOut, createAccountWithPasskey, loading: authLoading } = useAuthStore();
  const {
    profile,
    fetchProfile,
    updateAuthMethod,
    checkHasPasskey,
    loading: profileLoading,
  } = useProfileStore();
  const { showConfirm, showSuccess, showError } = useDialog();

  const [showEditModal, setShowEditModal] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [checkingPasskey, setCheckingPasskey] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
      // Check passkey from credentials table
      checkHasPasskey(user.id).then((result) => {
        setHasPasskey(result);
        setCheckingPasskey(false);
      });
    }
  }, [user]);

  const loading = authLoading || profileLoading;

  // Determine auth method
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
      // Keep original auth method but mark that user now has passkey
      await updateAuthMethod(user.id, profile?.primary_auth_method || 'password', true);
      setHasPasskey(true);
      await showSuccess('Passkey Added', 'You can now use biometric login!');
    } else {
      await showError('Error', result.error || 'Failed to add passkey');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

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
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <View style={styles.backgroundGradient}>
        <LinearGradient
          colors={['rgba(48, 209, 88, 0.12)', 'rgba(48, 209, 88, 0.03)', 'transparent']}
          locations={[0, 0.3, 0.6]}
          style={styles.gradientOrb}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

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
              <LinearGradient colors={[ACCENT, '#22C55E']} style={styles.avatarGradient}>
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

        {/* Edit Profile Button */}
        <Pressable
          style={({ pressed }) => [
            styles.editProfileButton,
            pressed && styles.editProfileButtonPressed,
          ]}
          onPress={() => setShowEditModal(true)}>
          <MaterialCommunityIcons name="pencil-outline" size={20} color={ACCENT} />
          <Text style={styles.editProfileText}>Edit Profile</Text>
        </Pressable>

        {/* Profile Details Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="account-circle-outline" size={20} color={ACCENT} />
            <Text style={styles.cardTitle}>Profile Details</Text>
          </View>

          {profile?.goal && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Goal</Text>
              <Text style={styles.detailValue}>
                {profile.goal.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
          )}

          {profile?.activity_level && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Activity Level</Text>
              <Text style={styles.detailValue}>
                {profile.activity_level.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </View>
          )}

          {profile?.preferred_sport && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sports</Text>
              <Text style={styles.detailValue}>
                {profile.preferred_sport
                  .split(',')
                  .map((s) => s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()))
                  .join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Security Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialCommunityIcons name="shield-check-outline" size={20} color={ACCENT} />
            <Text style={styles.cardTitle}>Security</Text>
          </View>

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
                <MaterialCommunityIcons name="fingerprint" size={14} color={ACCENT} />
                <Text style={[styles.authBadgeText, styles.authBadgeTextActive]}>Enabled</Text>
              </View>
            </View>
          )}

          {/* Add Passkey */}
          {!checkingPasskey && !hasPasskey && (
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              onPress={handleAddPasskey}>
              <View style={styles.actionIconContainer}>
                <MaterialCommunityIcons name="fingerprint" size={22} color={ACCENT} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Add Passkey</Text>
                <Text style={styles.actionDescription}>Enable biometric login</Text>
              </View>
              <MaterialCommunityIcons name="plus" size={24} color={ACCENT} />
            </Pressable>
          )}
        </View>

        {/* Sign Out Button */}
        <Pressable
          style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
          onPress={handleSignOut}>
          <MaterialCommunityIcons name="logout" size={20} color="#FF453A" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </Pressable>

        <Text style={styles.version}>Delta v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          // Refresh passkey status
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
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  gradientOrb: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: SCREEN_WIDTH,
    top: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.25,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: ACCENT,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#000',
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter-Regular',
  },
  username: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginTop: 4,
    fontFamily: 'Poppins-Bold',
  },
  quickStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins-Bold',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    borderRadius: 14,
    height: 48,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  editProfileButtonPressed: {
    opacity: 0.7,
  },
  editProfileText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT,
    fontFamily: 'Inter-SemiBold',
  },
  card: {
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter-Regular',
  },
  detailValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
    maxWidth: '60%',
    textAlign: 'right',
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  authBadgeActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
  },
  authBadgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  authBadgeTextActive: {
    color: ACCENT,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    gap: 12,
  },
  actionButtonPressed: {
    opacity: 0.7,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter-SemiBold',
  },
  actionDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 16,
    height: 56,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
  },
  signOutButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF453A',
    fontFamily: 'Inter-SemiBold',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 24,
    fontFamily: 'Inter-Regular',
  },
});
