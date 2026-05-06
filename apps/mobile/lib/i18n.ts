// lib/i18n.ts
//
// Minimal locale + translation runtime. Avoids the `expo-localization` native
// dep at MVP — we only need a 2-language switch ("en" / "pl") and Hermes
// already exposes `Intl.NumberFormat().resolvedOptions().locale`.
//
// Strings live in `apps/mobile/locales/<locale>.json`. Keys use dotted paths
// (e.g. `onboarding.welcome.title`). `t("a.b.c")` returns the resolved string,
// or the key itself if missing — so callers stay safe even before translations
// catch up.

import en from '../locales/en.json';
import pl from '../locales/pl.json';

export type Locale = 'en' | 'pl';

const REGISTRIES: Record<Locale, Record<string, unknown>> = { en, pl };

let activeLocale: Locale = detectLocale();

function detectLocale(): Locale {
  try {
    const tag = new Intl.NumberFormat().resolvedOptions().locale ?? 'en';
    return tag.toLowerCase().startsWith('pl') ? 'pl' : 'en';
  } catch {
    return 'en';
  }
}

export function getLocale(): Locale {
  return activeLocale;
}

export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const resolved = lookup(REGISTRIES[activeLocale], key) ?? lookup(REGISTRIES.en, key);
  if (resolved == null) return key;
  if (!params) return resolved;
  return resolved.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

function lookup(registry: Record<string, unknown>, key: string): string | null {
  const parts = key.split('.');
  let cur: unknown = registry;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  return typeof cur === 'string' ? cur : null;
}

export function formatCurrency(amount: number, currency: 'PLN' | 'USD' | 'EUR' = 'PLN'): string {
  try {
    return new Intl.NumberFormat(activeLocale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatNumber(value: number, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat(activeLocale, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return value.toFixed(fractionDigits);
  }
}
