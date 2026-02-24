// components/ui/Dialog.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Hook for easy dialog usage
import { createContext, useContext, useState, ReactNode } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCENT = '#30D158';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface DialogButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive' | 'primary';
}

interface DialogProps {
  visible: boolean;
  type?: DialogType;
  title: string;
  message: string;
  buttons?: DialogButton[];
  onClose: () => void;
}

const ICONS: Record<DialogType, { name: string; color: string }> = {
  info: { name: 'information-outline', color: '#007AFF' },
  success: { name: 'check-circle-outline', color: ACCENT },
  warning: { name: 'alert-outline', color: '#FF9500' },
  error: { name: 'close-circle-outline', color: '#FF453A' },
  confirm: { name: 'help-circle-outline', color: '#007AFF' },
};

export default function Dialog({
  visible,
  type = 'info',
  title,
  message,
  buttons = [{ text: 'OK', onPress: () => {}, style: 'primary' }],
  onClose,
}: DialogProps) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

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
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const icon = ICONS[type];

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case 'destructive':
        return { backgroundColor: 'rgba(255, 69, 58, 0.15)', textColor: '#FF453A' };
      case 'cancel':
        return { backgroundColor: 'rgba(255, 255, 255, 0.08)', textColor: 'rgba(255,255,255,0.8)' };
      case 'primary':
        return { backgroundColor: ACCENT, textColor: '#000' };
      default:
        return { backgroundColor: 'rgba(255, 255, 255, 0.1)', textColor: '#fff' };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <BlurView intensity={30} tint="dark" style={styles.blurOverlay}>
          <Pressable style={styles.backdropPress} onPress={onClose} />

          <Animated.View
            style={[
              styles.dialogContainer,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}>
            <LinearGradient
              colors={['rgba(40, 40, 45, 0.98)', 'rgba(28, 28, 30, 0.98)']}
              style={styles.dialog}>
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
                <MaterialCommunityIcons name={icon.name as any} size={32} color={icon.color} />
              </View>

              {/* Title */}
              <Text style={styles.title}>{title}</Text>

              {/* Message */}
              <Text style={styles.message}>{message}</Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {buttons.map((button, index) => {
                  const btnStyle = getButtonStyle(button.style);
                  return (
                    <Pressable
                      key={index}
                      style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: btnStyle.backgroundColor },
                        buttons.length === 1 && styles.buttonFull,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        button.onPress();
                        onClose();
                      }}>
                      <Text style={[styles.buttonText, { color: btnStyle.textColor }]}>
                        {button.text}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </LinearGradient>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

interface DialogContextType {
  showDialog: (config: Omit<DialogProps, 'visible' | 'onClose'>) => Promise<boolean>;
  showAlert: (title: string, message: string) => Promise<void>;
  showConfirm: (title: string, message: string) => Promise<boolean>;
  showError: (title: string, message: string) => Promise<void>;
  showSuccess: (title: string, message: string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogConfig, setDialogConfig] = useState<DialogProps | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const showDialog = (config: Omit<DialogProps, 'visible' | 'onClose'>): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
      setDialogConfig({
        ...config,
        visible: true,
        onClose: () => {
          setDialogConfig(null);
          resolve(false);
        },
      });
    });
  };

  const showAlert = (title: string, message: string): Promise<void> => {
    return showDialog({
      type: 'info',
      title,
      message,
      buttons: [{ text: 'OK', onPress: () => {}, style: 'primary' }],
    }).then(() => {});
  };

  const showConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialogConfig({
        visible: true,
        type: 'confirm',
        title,
        message,
        buttons: [
          { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Confirm', onPress: () => resolve(true), style: 'primary' },
        ],
        onClose: () => {
          setDialogConfig(null);
          resolve(false);
        },
      });
    });
  };

  const showError = (title: string, message: string): Promise<void> => {
    return showDialog({
      type: 'error',
      title,
      message,
      buttons: [{ text: 'OK', onPress: () => {}, style: 'destructive' }],
    }).then(() => {});
  };

  const showSuccess = (title: string, message: string): Promise<void> => {
    return showDialog({
      type: 'success',
      title,
      message,
      buttons: [{ text: 'Done', onPress: () => {}, style: 'primary' }],
    }).then(() => {});
  };

  return (
    <DialogContext.Provider value={{ showDialog, showAlert, showConfirm, showError, showSuccess }}>
      {children}
      {dialogConfig && <Dialog {...dialogConfig} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  blurOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  dialogContainer: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 340,
  },
  dialog: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Poppins-Bold',
  },
  message: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonFull: {
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});
