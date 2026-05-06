// app/onboarding/paywall.tsx
//
// Soft paywall — annual-led pricing with PLN localization. The actual billing
// integration (RevenueCat) lands in a follow-up; for now "Start premium" simply
// marks the wall as seen so the user lands on the main app, and we surface the
// value props of the premium tier.

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SLEEP_FONTS, SLEEP_LAYOUT, SLEEP_THEME } from '@constants';
import { formatCurrency, getLocale, t } from '@lib/i18n';

const ACCENT = '#7C3AED';

const PRICING = {
  pl: { annual: 199, monthly: 29, currency: 'PLN' as const },
  en: { annual: 49.99, monthly: 6.99, currency: 'USD' as const },
};

export default function PaywallScreen() {
  const locale = getLocale();
  const tier = locale === 'pl' ? PRICING.pl : PRICING.en;

  const annualPerMonth = useMemo(
    () => formatCurrency(tier.annual / 12, tier.currency),
    [tier],
  );

  const handleSubscribe = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // TODO: RevenueCat purchase flow — for now treat as soft accept.
    router.replace('/(tabs)/workout');
  };

  const handleSkip = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)/workout');
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.crown}>
          <MaterialCommunityIcons name="crown" size={36} color={ACCENT} />
        </View>
        <Text style={styles.title}>{t('paywall.title')}</Text>

        <View style={styles.valueProps}>
          <ValueProp icon="chart-line" label={t('paywall.valueProps.hypnogram')} />
          <ValueProp icon="brain" label={t('paywall.valueProps.morningBrief')} />
          <ValueProp icon="sparkles" label={t('paywall.valueProps.predictions')} />
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceCardHeader}>
            <Text style={styles.priceLabel}>{t('paywall.annual')}</Text>
            <View style={styles.savingsPill}>
              <Text style={styles.savingsText}>−40%</Text>
            </View>
          </View>
          <Text style={styles.priceValue}>
            {annualPerMonth}
            <Text style={styles.priceUnit}>{t('paywall.perMonth')}</Text>
          </Text>
          <Text style={styles.priceFootnote}>
            {formatCurrency(tier.annual, tier.currency)} / yr
          </Text>
        </View>

        <View style={styles.priceCardSecondary}>
          <Text style={styles.priceLabel}>{t('paywall.monthly')}</Text>
          <Text style={styles.priceValueSm}>
            {formatCurrency(tier.monthly, tier.currency)}
            <Text style={styles.priceUnit}>{t('paywall.perMonth')}</Text>
          </Text>
        </View>

        <Pressable onPress={handleSubscribe} style={styles.cta}>
          <Text style={styles.ctaText}>{t('paywall.cta')}</Text>
        </Pressable>

        <Pressable onPress={handleSkip} style={styles.skip} hitSlop={10}>
          <Text style={styles.skipText}>{t('paywall.skip')}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ValueProp({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={styles.valuePropRow}>
      <View style={styles.valuePropIcon}>
        <MaterialCommunityIcons name={icon as never} size={18} color={ACCENT} />
      </View>
      <Text style={styles.valuePropLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SLEEP_THEME.screenBg },
  scroll: {
    paddingHorizontal: SLEEP_LAYOUT.screenPaddingH,
    paddingTop: 80,
    paddingBottom: 40,
    gap: 18,
  },
  crown: { alignSelf: 'center' },
  title: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 28,
    color: SLEEP_THEME.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  valueProps: { gap: 10, marginBottom: 16 },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  valuePropIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropLabel: {
    flex: 1,
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 15,
    color: SLEEP_THEME.textPrimary,
  },
  priceCard: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: 18,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  priceCardSecondary: {
    backgroundColor: SLEEP_THEME.cardBg,
    borderRadius: SLEEP_LAYOUT.cardRadiusOuter,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: SLEEP_THEME.border,
  },
  priceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceLabel: {
    fontFamily: SLEEP_FONTS.semiBold,
    fontSize: 13,
    color: SLEEP_THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  savingsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(48,209,88,0.18)',
  },
  savingsText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 11,
    color: SLEEP_THEME.zoneBarGreat,
  },
  priceValue: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 30,
    color: SLEEP_THEME.textPrimary,
  },
  priceValueSm: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 22,
    color: SLEEP_THEME.textPrimary,
  },
  priceUnit: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 14,
    color: SLEEP_THEME.textSecondary,
  },
  priceFootnote: {
    fontFamily: SLEEP_FONTS.regular,
    fontSize: 12,
    color: SLEEP_THEME.textMuted1,
    marginTop: 2,
  },
  cta: {
    backgroundColor: ACCENT,
    height: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: {
    fontFamily: SLEEP_FONTS.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  skip: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  skipText: {
    fontFamily: SLEEP_FONTS.medium,
    fontSize: 13,
    color: SLEEP_THEME.textMuted1,
  },
});
