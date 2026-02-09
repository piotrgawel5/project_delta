// components/sleep/EditHistoryBadge.tsx
// Component to show edit history and provenance for sleep records

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';

const ACCENT_PURPLE = '#7C3AED';
const ACCENT_YELLOW = '#FBBF24';
const ACCENT_GREEN = '#34D399';
const ACCENT_ORANGE = '#F97316';

const BADGE_PADDING_Y = 6;
const BADGE_INNER_RADIUS = 4;
const BADGE_RADIUS = BADGE_INNER_RADIUS + BADGE_PADDING_Y;
const CONFIDENCE_DOT_SIZE = 6;
const CONFIDENCE_DOT_RADIUS = CONFIDENCE_DOT_SIZE / 2;
const EDIT_COUNT_PADDING_Y = 2;
const EDIT_COUNT_INNER_RADIUS = 4;
const EDIT_COUNT_RADIUS = EDIT_COUNT_INNER_RADIUS + EDIT_COUNT_PADDING_Y;
const MODAL_PADDING_TOP = 16;
const MODAL_INNER_RADIUS = 12;
const MODAL_RADIUS = MODAL_INNER_RADIUS + MODAL_PADDING_TOP;
const CLOSE_BTN_SIZE = 32;
const CLOSE_BTN_RADIUS = CLOSE_BTN_SIZE / 2;
const CARD_PADDING = 16;
const CARD_INNER_RADIUS = 8;
const CARD_RADIUS = CARD_INNER_RADIUS + CARD_PADDING;
const ICON_SIZE = 48;
const ICON_RADIUS = Math.round(ICON_SIZE * 0.3);
const BAR_HEIGHT = 6;
const BAR_RADIUS = BAR_HEIGHT / 2;
const EDIT_DOT_SIZE = 10;
const EDIT_DOT_RADIUS = EDIT_DOT_SIZE / 2;
const CHANGE_CARD_PADDING = 10;
const CHANGE_CARD_INNER_RADIUS = 6;
const CHANGE_CARD_RADIUS = CHANGE_CARD_INNER_RADIUS + CHANGE_CARD_PADDING;

export interface SleepEdit {
  timestamp: string;
  editedBy: 'user' | 'system' | 'sync';
  reason: string;
  previousValues?: {
    duration_minutes?: number;
    start_time?: string;
    end_time?: string;
    quality_score?: number;
    sleep_score?: number;
    [key: string]: any;
  };
  newValues?: {
    duration_minutes?: number;
    start_time?: string;
    end_time?: string;
    quality_score?: number;
    sleep_score?: number;
    [key: string]: any;
  };
}

interface EditHistoryBadgeProps {
  edits: SleepEdit[];
  source: 'health_connect' | 'digital_wellbeing' | 'usage_stats' | 'wearable' | 'manual';
  confidence: 'high' | 'medium' | 'low';
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatFieldName(field: string): string {
  return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(field: string, value: any): string {
  if (value === undefined || value === null) return '–';

  if (field.includes('time') && typeof value === 'string') {
    try {
      const date = new Date(value);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return value;
    }
  }

  if (field === 'duration_minutes') {
    const hrs = Math.floor(value / 60);
    const mins = value % 60;
    return `${hrs}h ${mins}m`;
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return String(value);
}

function getSourceInfo(source: string): { label: string; icon: string; color: string } {
  switch (source) {
    case 'health_connect':
      return { label: 'Health Connect', icon: 'fitness-outline', color: ACCENT_GREEN };
    case 'wearable':
      return { label: 'Wearable', icon: 'watch-outline', color: ACCENT_PURPLE };
    case 'manual':
      return { label: 'Manual Entry', icon: 'create-outline', color: ACCENT_ORANGE };
    case 'usage_stats':
      return { label: 'Screen Time', icon: 'phone-portrait-outline', color: '#38BDF8' };
    case 'digital_wellbeing':
      return { label: 'Digital Wellbeing', icon: 'phone-portrait-outline', color: '#38BDF8' };
    default:
      return { label: 'Unknown', icon: 'help-circle-outline', color: '#64748B' };
  }
}

function getConfidenceInfo(confidence: string): { label: string; color: string; opacity: number } {
  switch (confidence) {
    case 'high':
      return { label: 'High Confidence', color: ACCENT_GREEN, opacity: 1 };
    case 'medium':
      return { label: 'Medium Confidence', color: ACCENT_YELLOW, opacity: 0.85 };
    case 'low':
      return { label: 'Low Confidence', color: ACCENT_ORANGE, opacity: 0.7 };
    default:
      return { label: 'Unknown', color: '#64748B', opacity: 0.5 };
  }
}

function getEditTypeInfo(editedBy: string): { icon: string; color: string } {
  switch (editedBy) {
    case 'user':
      return { icon: 'person-outline', color: ACCENT_PURPLE };
    case 'system':
      return { icon: 'cog-outline', color: '#64748B' };
    case 'sync':
      return { icon: 'sync-outline', color: ACCENT_GREEN };
    default:
      return { icon: 'ellipsis-horizontal-outline', color: '#64748B' };
  }
}

/**
 * Edit History Badge and Modal Component
 */
export function EditHistoryBadge({ edits, source, confidence }: EditHistoryBadgeProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const sourceInfo = getSourceInfo(source);
  const confidenceInfo = getConfidenceInfo(confidence);
  const hasEdits = edits && edits.length > 0;

  return (
    <>
      {/* Compact badge */}
      <Pressable
        style={[styles.badge, hasEdits && styles.badgeEdited]}
        onPress={() => setModalVisible(true)}>
        <View style={[styles.confidenceDot, { backgroundColor: confidenceInfo.color }]} />
        <Text style={styles.badgeText}>{sourceInfo.label}</Text>
        {hasEdits && (
          <View style={styles.editCountBadge}>
            <Ionicons name="create-outline" size={10} color="#fff" />
            <Text style={styles.editCountText}>{edits.length}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.4)" />
      </Pressable>

      {/* Detail modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.modalContent}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Data Provenance</Text>
                <Pressable style={styles.closeButton} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Source card */}
                <Animated.View entering={FadeInDown.delay(100)} style={styles.sourceCard}>
                  <LinearGradient
                    colors={[sourceInfo.color + '20', 'transparent']}
                    style={styles.sourceGradient}
                  />
                  <View style={styles.sourceHeader}>
                    <View style={[styles.sourceIcon, { backgroundColor: sourceInfo.color + '30' }]}>
                      <Ionicons name={sourceInfo.icon as any} size={24} color={sourceInfo.color} />
                    </View>
                    <View style={styles.sourceInfo}>
                      <Text style={styles.sourceLabel}>Data Source</Text>
                      <Text style={[styles.sourceValue, { color: sourceInfo.color }]}>
                        {sourceInfo.label}
                      </Text>
                    </View>
                  </View>
                </Animated.View>

                {/* Confidence card */}
                <Animated.View entering={FadeInDown.delay(150)} style={styles.confidenceCard}>
                  <View style={styles.confidenceHeader}>
                    <View style={styles.confidenceBarBg}>
                      <View
                        style={[
                          styles.confidenceBar,
                          {
                            width: `${confidenceInfo.opacity * 100}%`,
                            backgroundColor: confidenceInfo.color,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.confidenceLabel, { color: confidenceInfo.color }]}>
                      {confidenceInfo.label}
                    </Text>
                  </View>
                  <Text style={styles.confidenceDescription}>
                    {confidence === 'high' && 'Data from reliable source with complete stages.'}
                    {confidence === 'medium' && 'Some data may be estimated or incomplete.'}
                    {confidence === 'low' && 'Limited data available, estimates may vary.'}
                  </Text>
                </Animated.View>

                {/* Edit history */}
                {hasEdits && (
                  <Animated.View entering={FadeInDown.delay(200)} style={styles.editSection}>
                    <View style={styles.editSectionHeader}>
                      <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.6)" />
                      <Text style={styles.editSectionTitle}>Edit History</Text>
                    </View>

                    {edits.map((edit, index) => {
                      const editType = getEditTypeInfo(edit.editedBy);
                      const changedFields = edit.previousValues
                        ? Object.keys(edit.previousValues)
                        : [];

                      return (
                        <Animated.View
                          key={index}
                          entering={FadeInDown.delay(250 + index * 50)}
                          style={styles.editItem}>
                          <View style={styles.editTimelineIndicator}>
                            <View style={[styles.editDot, { backgroundColor: editType.color }]} />
                            {index < edits.length - 1 && <View style={styles.editLine} />}
                          </View>

                          <View style={styles.editContent}>
                            <View style={styles.editHeader}>
                              <Ionicons
                                name={editType.icon as any}
                                size={14}
                                color={editType.color}
                              />
                              <Text style={styles.editTimestamp}>
                                {formatTimestamp(edit.timestamp)}
                              </Text>
                            </View>

                            <Text style={styles.editReason}>{edit.reason}</Text>

                            {changedFields.length > 0 && (
                              <View style={styles.editChanges}>
                                {changedFields.slice(0, 3).map((field) => (
                                  <View key={field} style={styles.changeRow}>
                                    <Text style={styles.changeField}>
                                      {formatFieldName(field)}:
                                    </Text>
                                    <Text style={styles.changeOld}>
                                      {formatValue(field, edit.previousValues?.[field])}
                                    </Text>
                                    <Ionicons
                                      name="arrow-forward"
                                      size={10}
                                      color="rgba(255,255,255,0.3)"
                                    />
                                    <Text style={styles.changeNew}>
                                      {formatValue(field, edit.newValues?.[field])}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </Animated.View>
                      );
                    })}
                  </Animated.View>
                )}

                {!hasEdits && (
                  <Animated.View entering={FadeInDown.delay(200)} style={styles.noEditsContainer}>
                    <Ionicons name="checkmark-circle" size={32} color={ACCENT_GREEN} />
                    <Text style={styles.noEditsText}>Original data, no edits</Text>
                  </Animated.View>
                )}
              </ScrollView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: BADGE_PADDING_Y,
    borderRadius: BADGE_RADIUS,
    gap: 6,
  },
  badgeEdited: {
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  confidenceDot: {
    width: CONFIDENCE_DOT_SIZE,
    height: CONFIDENCE_DOT_SIZE,
    borderRadius: CONFIDENCE_DOT_RADIUS,
  },
  badgeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  editCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_ORANGE,
    paddingHorizontal: 5,
    paddingVertical: EDIT_COUNT_PADDING_Y,
    borderRadius: EDIT_COUNT_RADIUS,
    gap: 2,
  },
  editCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0A12',
    borderTopLeftRadius: MODAL_RADIUS,
    borderTopRightRadius: MODAL_RADIUS,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  closeButton: {
    width: CLOSE_BTN_SIZE,
    height: CLOSE_BTN_SIZE,
    borderRadius: CLOSE_BTN_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    padding: 20,
  },
  sourceCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sourceGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  sourceIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceInfo: {
    flex: 1,
  },
  sourceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  sourceValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  confidenceCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginBottom: 16,
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  confidenceBarBg: {
    flex: 1,
    height: BAR_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BAR_RADIUS,
    overflow: 'hidden',
  },
  confidenceBar: {
    height: '100%',
    borderRadius: BAR_RADIUS,
  },
  confidenceLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 18,
  },
  editSection: {
    marginBottom: 24,
  },
  editSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  editSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  editItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  editTimelineIndicator: {
    width: 20,
    alignItems: 'center',
  },
  editDot: {
    width: EDIT_DOT_SIZE,
    height: EDIT_DOT_SIZE,
    borderRadius: EDIT_DOT_RADIUS,
  },
  editLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 4,
  },
  editContent: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  editTimestamp: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },
  editReason: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    marginBottom: 8,
  },
  editChanges: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: CHANGE_CARD_RADIUS,
    padding: CHANGE_CARD_PADDING,
    gap: 6,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeField: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
  },
  changeOld: {
    fontSize: 11,
    color: 'rgba(255,100,100,0.8)',
    textDecorationLine: 'line-through',
  },
  changeNew: {
    fontSize: 11,
    color: ACCENT_GREEN,
    fontWeight: '600',
  },
  noEditsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noEditsText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },
});

export default EditHistoryBadge;
