import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SleepHeaderProps {
  currentDate: Date;
  onPrevDate: () => void;
  onNextDate: () => void;
  isToday: boolean;
}

export const SleepHeader = ({ currentDate, onPrevDate, onNextDate, isToday }: SleepHeaderProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { marginTop: insets.top }]}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Sleep</Text>
        <Pressable style={styles.moreBtn}>
          <Ionicons name="ellipsis-horizontal-circle" size={24} color="#34D399" />
        </Pressable>
      </View>

      <View style={styles.dateRow}>
        <Pressable onPress={onPrevDate} style={styles.arrowBtn}>
          <Ionicons name="chevron-back" size={20} color="#34D399" />
        </Pressable>

        <Text style={styles.dateText}>
          {currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        <Pressable
          onPress={onNextDate}
          style={[styles.arrowBtn, isToday && styles.arrowBtnDisabled]}
          disabled={isToday}>
          <Ionicons name="chevron-forward" size={20} color={isToday ? '#333' : '#34D399'} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
  },
  moreBtn: {
    opacity: 0.8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  arrowBtn: {
    padding: 4,
  },
  arrowBtnDisabled: {
    opacity: 0.3,
  },
});
