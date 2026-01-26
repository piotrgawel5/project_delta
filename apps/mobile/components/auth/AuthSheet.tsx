// components/auth/AuthSheet.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  Dimensions,
  Keyboard,
  Platform,
  Easing,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { signInWithGoogle } from '@lib/auth';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const DRAG_THRESHOLD = 80;
const ACCENT = '#30D158';

// Dynamic heights for each mode
const HEIGHTS = {
  choose: 400,
  email_login: 420,
  email_signup: 480,
  passkey_signup: 400,
  authenticating: 320,
};

type AuthMode = 'choose' | 'email_login' | 'email_signup' | 'passkey_signup' | 'authenticating';

type Props = {
  setStarted: (value: boolean) => void;
};

export default function AuthSheet({ setStarted }: Props) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AuthMode>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState('Authenticating...');
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const {
    passkeySupported,
    createAccountWithPasskey,
    signInWithPasskey,
    signIn,
    signUp,
    checkPasskeySupport,
  } = useAuthStore();

  // Animation refs
  const translateY = useRef(new Animated.Value(HEIGHTS.choose)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const handleOpacity = useRef(new Animated.Value(0.4)).current;
  const errorShake = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(HEIGHTS.choose);

  const lastOffset = useRef(0);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // Keyboard listeners - animate sheet up when keyboard shows
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      // Move sheet up by a portion of keyboard height
      Animated.spring(keyboardOffset, {
        toValue: -e.endCoordinates.height * 0.9,
        damping: 20,
        stiffness: 150,
        useNativeDriver: true,
      }).start();
    });

    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      Animated.spring(keyboardOffset, {
        toValue: 0,
        damping: 20,
        stiffness: 150,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // Loading animation
  useEffect(() => {
    if (mode === 'authenticating') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      pulseAnim.setValue(1);
      rotateAnim.setValue(0);
    }
  }, [mode]);

  // Entrance + height animation
  useEffect(() => {
    checkPasskeySupport();
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 28,
        stiffness: 150,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Update height on mode change with layout animation
  useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSheetHeight(HEIGHTS[mode]);
  }, [mode]);

  const showError = (msg: string) => {
    setError(msg);
    Animated.sequence([
      Animated.timing(errorShake, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 5, duration: 50, useNativeDriver: true }),
      Animated.timing(errorShake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setError(null), 3500);
  };

  const handleSuccess = async (
    authMethod: 'password' | 'google' | 'passkey' = 'password',
    isNewUser: boolean = false
  ) => {
    setAuthStatus('Welcome! 🎉');

    // Small delay for visual feedback, then route to loading screen
    setTimeout(async () => {
      // Store the auth method for new users
      if (isNewUser) {
        const { user } = useAuthStore.getState();
        if (user) {
          // Create initial profile with auth method
          const { api } = await import('@lib/api');
          await api.post(`/api/profile/${user.id}`, {
            user_id: user.id,
            primary_auth_method: authMethod,
            has_passkey: authMethod === 'passkey',
          });
        }
      }

      Animated.timing(translateY, {
        toValue: HEIGHTS[mode] + 50,
        duration: 220,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        setStarted(false);
        router.replace('/loading');
      });
    }, 400);
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setMode('authenticating');
    setAuthStatus('Connecting to Google...');
    try {
      const ok = await signInWithGoogle(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!);
      if (ok) handleSuccess('google', true);
      else setMode('choose');
    } catch (err: any) {
      if (!err.message?.includes('cancelled')) showError('Google sign-in failed');
      setMode('choose');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    if (loading) return;
    setLoading(true);
    setMode('authenticating');
    setAuthStatus('Verifying identity...');
    try {
      const result = await signInWithPasskey();
      if (!result.success) {
        if (result.error === 'cancelled') setMode('choose');
        else if (result.error === 'no_passkey') setMode('passkey_signup');
        else {
          showError(result.error || 'Authentication failed');
          setMode('choose');
        }
      } else {
        handleSuccess('passkey', false); // Existing user logging in
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (loading) return;
    if (!email.trim() || !password) {
      showError('Enter email and password');
      return;
    }
    setLoading(true);
    setMode('authenticating');
    setAuthStatus('Signing in...');
    Keyboard.dismiss();
    try {
      const { error: err } = await signIn(email.trim().toLowerCase(), password);
      if (err) {
        showError(err.message || 'Invalid credentials');
        setMode('email_login');
      } else {
        handleSuccess('password', false); // Existing user logging in
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async () => {
    if (loading) return;
    if (!email.trim() || !password || !confirmPassword) {
      showError('Fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      showError('Password must be 6+ characters');
      return;
    }
    setLoading(true);
    setMode('authenticating');
    setAuthStatus('Creating account...');
    Keyboard.dismiss();
    try {
      const { error: err } = await signUp(email.trim().toLowerCase(), password);
      if (err) {
        showError(err.message || 'Signup failed');
        setMode('email_signup');
      } else {
        handleSuccess('password', true); // New user
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyCreate = async () => {
    if (loading || !email.trim()) {
      if (!email.trim()) showError('Enter your email');
      return;
    }
    setLoading(true);
    setMode('authenticating');
    setAuthStatus('Creating passkey...');
    Keyboard.dismiss();
    try {
      const result = await createAccountWithPasskey(email.trim().toLowerCase());
      if (!result.success) {
        if (result.error !== 'cancelled') showError(result.error || 'Failed');
        setMode('passkey_signup');
      } else {
        handleSuccess('passkey', true); // New user with passkey
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    Animated.timing(contentOpacity, { toValue: 0, duration: 80, useNativeDriver: true }).start(
      () => {
        setMode(newMode);
        setError(null);
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }).start();
      }
    );
  };

  const closeSheet = () => {
    Keyboard.dismiss();
    Animated.timing(translateY, {
      toValue: HEIGHTS[mode] + 50,
      duration: 200,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => setStarted(false));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        translateY.stopAnimation((v) => (lastOffset.current = v));
        Animated.timing(handleOpacity, {
          toValue: 0.8,
          duration: 60,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (_, g) => {
        if (g.dy >= 0) translateY.setValue(lastOffset.current + g.dy);
      },
      onPanResponderRelease: (_, g) => {
        Animated.timing(handleOpacity, {
          toValue: 0.4,
          duration: 60,
          useNativeDriver: true,
        }).start();
        if (g.dy > DRAG_THRESHOLD || g.vy > 0.5) closeSheet();
        else
          Animated.spring(translateY, {
            toValue: 0,
            damping: 25,
            stiffness: 150,
            useNativeDriver: true,
          }).start(() => (lastOffset.current = 0));
      },
    })
  ).current;

  const rotation = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View
      style={[
        styles.container,
        { height: sheetHeight, transform: [{ translateY: keyboardOffset }] },
      ]}>
      <Animated.View style={[styles.sheetWrapper, { transform: [{ translateY }] }]}>
        <BlurView intensity={60} tint="dark" style={styles.blurContainer}>
          <View {...panResponder.panHandlers} style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handleContainer}>
              <Animated.View style={[styles.handle, { opacity: handleOpacity }]} />
            </View>

            {/* Branding */}
            <View style={styles.brandRow}>
              <View style={styles.brandMark}>
                <Text style={styles.brandLetter}>Δ</Text>
              </View>
              <Text style={styles.brandText}>Delta ID</Text>
            </View>

            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollInner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <Animated.View style={{ opacity: contentOpacity }}>
                {/* Error */}
                {error && (
                  <Animated.View
                    style={[styles.errorBanner, { transform: [{ translateX: errorShake }] }]}>
                    <Text style={styles.errorText}>{error}</Text>
                  </Animated.View>
                )}

                {/* Authenticating */}
                {mode === 'authenticating' && (
                  <View style={styles.authContainer}>
                    <Animated.View
                      style={[styles.authIconWrap, { transform: [{ scale: pulseAnim }] }]}>
                      <Animated.View
                        style={[styles.authIconRing, { transform: [{ rotate: rotation }] }]}>
                        <Svg width={64} height={64} viewBox="0 0 64 64">
                          <Defs>
                            <SvgGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
                              <Stop offset="0%" stopColor={ACCENT} />
                              <Stop offset="100%" stopColor="#22C55E" />
                            </SvgGradient>
                          </Defs>
                          <Circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="url(#rg)"
                            strokeWidth="3"
                            fill="none"
                            strokeDasharray="120 50"
                            strokeLinecap="round"
                          />
                        </Svg>
                      </Animated.View>
                      <View style={styles.authIconCenter}>
                        <FingerprintIcon size={24} color={ACCENT} />
                      </View>
                    </Animated.View>
                    <Text style={styles.authTitle}>{authStatus}</Text>
                  </View>
                )}

                {/* Choose */}
                {mode === 'choose' && (
                  <>
                    <Text style={styles.title}>Welcome back</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>

                    <View style={styles.buttonGroup}>
                      {passkeySupported && (
                        <TouchableOpacity
                          onPress={handlePasskeySignIn}
                          disabled={loading}
                          activeOpacity={0.85}
                          style={styles.primaryButton}>
                          <FingerprintIcon size={18} color="#000" />
                          <Text style={styles.primaryButtonText}>Continue with Passkey</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={handleGoogleSignIn}
                        disabled={loading}
                        activeOpacity={0.8}
                        style={styles.secondaryButton}>
                        <GoogleIcon />
                        <Text style={styles.secondaryButtonText}>Continue with Google</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => switchMode('email_login')}
                        style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>Sign in with Email</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.dividerRow}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>or</Text>
                      <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        switchMode(passkeySupported ? 'passkey_signup' : 'email_signup')
                      }
                      style={styles.linkWrap}>
                      <Text style={styles.linkText}>Create a new account</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Email Login */}
                {mode === 'email_login' && (
                  <>
                    <TouchableOpacity
                      onPress={() => switchMode('choose')}
                      style={styles.backButton}>
                      <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Sign in</Text>
                    <Text style={styles.subtitle}>Enter your credentials</Text>

                    <View style={styles.inputGroup}>
                      <TextInput
                        ref={emailRef}
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="next"
                        onSubmitEditing={() => passwordRef.current?.focus()}
                      />
                      <TextInput
                        ref={passwordRef}
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        returnKeyType="go"
                        onSubmitEditing={handleEmailLogin}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={handleEmailLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                      style={styles.primaryButton}>
                      <Text style={styles.primaryButtonText}>Sign In</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Email Signup */}
                {mode === 'email_signup' && (
                  <>
                    <TouchableOpacity
                      onPress={() => switchMode('choose')}
                      style={styles.backButton}>
                      <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Create account</Text>
                    <Text style={styles.subtitle}>Sign up with email</Text>

                    <View style={styles.inputGroup}>
                      <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm Password"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                      />
                    </View>

                    <TouchableOpacity
                      onPress={handleEmailSignup}
                      disabled={loading}
                      activeOpacity={0.85}
                      style={styles.primaryButton}>
                      <Text style={styles.primaryButtonText}>Create Account</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Passkey Signup */}
                {mode === 'passkey_signup' && (
                  <>
                    <TouchableOpacity
                      onPress={() => switchMode('choose')}
                      style={styles.backButton}>
                      <Text style={styles.backArrow}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>Create account</Text>
                    <Text style={styles.subtitle}>Secure with passkey</Text>

                    <View style={styles.inputGroup}>
                      <TextInput
                        style={styles.input}
                        placeholder="Email address"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={handlePasskeyCreate}
                      disabled={loading}
                      activeOpacity={0.85}
                      style={styles.primaryButton}>
                      <FingerprintIcon size={18} color="#000" />
                      <Text style={styles.primaryButtonText}>Create with Passkey</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => switchMode('email_signup')}
                      style={styles.linkWrap}>
                      <Text style={styles.linkTextSmall}>or use email & password</Text>
                    </TouchableOpacity>
                  </>
                )}
              </Animated.View>
            </ScrollView>
          </View>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}

function FingerprintIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2a5 5 0 0 0-5 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M17 7a5 5 0 0 0-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M7 7v1a5 5 0 0 0 10 0V7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M12 17v5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="8" r="1.5" fill={color} />
    </Svg>
  );
}

function GoogleIcon() {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  sheetWrapper: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  blurContainer: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheet: {
    flex: 1,
    backgroundColor: 'rgba(12,12,12,0.96)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#555',
    borderRadius: 2,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
  },
  brandMark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(48,209,88,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: ACCENT,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
    marginBottom: 20,
    fontWeight: '500',
  },
  backButton: {
    marginBottom: 8,
  },
  backArrow: {
    fontSize: 24,
    color: '#888',
  },
  buttonGroup: {
    gap: 10,
  },
  primaryButton: {
    height: 52,
    backgroundColor: ACCENT,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '500',
  },
  linkWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  linkText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },
  linkTextSmall: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 14,
  },
  inputGroup: {
    gap: 10,
    marginBottom: 16,
  },
  input: {
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  authContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  authIconWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  authIconRing: {
    position: 'absolute',
  },
  authIconCenter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(48,209,88,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
