# i18n + Paywall

## i18n shim — `apps/mobile/lib/i18n.ts`

Tiny synchronous helper, no native deps:

```ts
import { t, getLocale, setLocale, formatCurrency, formatNumber } from '@lib/i18n';

t('paywall.cta');                         // "Start premium"
formatCurrency(199, 'PLN');               // "199 zł"
```

- Locale detected from `Intl.NumberFormat().resolvedOptions().locale` (Hermes-available, no `expo-localization` native dep).
- Currently supports `en` (fallback) and `pl`.
- Missing keys in active locale fall back to `en`.

### Adding a string

1. Add the key to `apps/mobile/locales/en.json` (canonical).
2. Add the translation to every other locale file (`pl.json`, …).
3. Use `t('group.key')` in components — never hardcode.

## Paywall — `apps/mobile/app/onboarding/paywall.tsx`

Soft paywall with annual-led pricing, registered as a screen in `app/onboarding/_layout.tsx`. Subscribe and Skip both `router.replace('/(tabs)/workout')` for now — RevenueCat purchase flow is a TODO (`lib/billing.ts` + `services/api/src/modules/billing/` webhook are deferred).

Pricing tiers in the file:

```ts
const PRICING = {
  pl: { annual: 199, monthly: 29, currency: 'PLN' },
  en: { annual: 49.99, monthly: 6.99, currency: 'USD' },
};
```

## Loading-flow gating — `apps/mobile/app/loading.tsx`

After `fetchProfile()` resolves:

```
profile.onboarding_completed?
  ├── no  → /onboarding/username
  └── yes
      ├── plan === 'free' && !AsyncStorage.getItem('@delta:paywall_seen_at')
      │      → /onboarding/paywall  (and write the flag)
      └── otherwise
             → /(tabs)/workout
```

The AsyncStorage flag ensures free users see the paywall **once** per install, not on every launch.
