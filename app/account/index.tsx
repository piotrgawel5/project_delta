import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!session) {
    return router.push('/');
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const user = session.user;
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = user.user_metadata?.avatar_url;
  const initials = getInitials(displayName);

  return (
    <View style={styles.protectedContainer}>
      <View style={styles.header}>
        {/* Avatar Section */}
        <View style={styles.avatarContainer}>
          {avatarUrl && !avatarError ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              /* contentFit="cover" */
              onError={() => setAvatarError(true)}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        <Text style={styles.greeting}>Hello, {displayName}! 👋</Text>
        <Text style={styles.subGreeting}>Welcome back </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Name</Text>
          <Text style={styles.cardValue}>{user.user_metadata?.full_name || 'Not set'}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>Email</Text>
          <Text style={styles.cardValue}>{user.email}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardRow}>
          <Text style={styles.cardLabel}>User ID</Text>
          <Text style={styles.cardValueSmall} numberOfLines={1}>
            {user.id}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutButtonPressed]}
        onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  protectedContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0a0a0a',
    marginBottom: 4,
    textAlign: 'center',
  },
  subGreeting: {
    fontSize: 16,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 32,
  },
  cardRow: {
    paddingVertical: 12,
  },
  cardLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  cardValue: {
    fontSize: 18,
    color: '#0a0a0a',
    fontWeight: '500',
  },
  cardValueSmall: {
    fontSize: 14,
    color: '#0a0a0a',
    fontWeight: '400',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  signOutButton: {
    backgroundColor: '#ff4444',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  signOutButtonPressed: {
    backgroundColor: '#cc0000',
    transform: [{ scale: 0.98 }],
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
