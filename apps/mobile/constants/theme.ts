export const SLEEP_THEME = {
  screenBg: '#000000',
  // OLED-optimized surface for all standard bottom sheets — pure black maximises contrast
  // and eliminates the grey bloom that cardBg produces on OLED panels.
  bottomSheetBg: '#000000',
  cardBg: '#1C1C1E',
  elevatedBg: '#2C2C2E',
  cardInset: '#232326',
  border: '#3A3A3C',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.75)',
  textMuted1: '#8E8E93',
  textMuted2: '#636366',
  textDisabled: 'rgba(255,255,255,0.4)',
  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  colorDeep: '#BF5AF2',
  colorLight: '#32ADE6',
  colorREM: '#5E5CE6',
  colorAwake: '#FF9F0A',
  colorBedtime: '#5E5CE6',
  heroGradientPrimary: '#2D7A3A',
  heroGradientMid: '#0A1A0E',
  heroGradientEnd: '#000000',
  heroOverlayStart: '#4CAF6A',
  heroOverlayEnd: '#000000',
  chartLine: '#FFFFFF',
  chartLineOpacityDimmed: 0.5,
  chartDotFill: '#3A3A3C',
  chartDotToday: '#FFFFFF',
  chartGlowRing: 'rgba(255,255,255,0.20)',
  chartTooltipBg: '#1C1C1E',
  zoneBarLow: '#FF453A',
  zoneBarFair: '#FF9F0A',
  zoneBarGreat: '#30D158',
  navbarBg: 'rgba(18,18,18,0.40)',
  navbarBorder: 'rgba(255,255,255,0.08)',
  navbarBlurIntensity: 11.5,
  navbarActiveColor: '#FFFFFF',
  navbarInactiveOpacity: 0.45,
  badgePillBg: '#1C1C1E',
  badgePillOverlay: 'rgba(255,255,255,0.10)',
  heroDurationPillBg: 'rgba(255,255,255,0.18)',
  heroDurationPillText: '#FFFFFF',
  onTrackPillBg: '#2C2C2E',
  onTrackPillText: '#30D158',
  warningPillBg: 'rgba(255,159,10,0.15)',
  lowPillBg: 'rgba(255,69,58,0.15)',
  lowPillText: '#FF453A',
  skeletonBase: 'rgba(255,255,255,0.06)',
  skeletonHighlight: 'rgba(255,255,255,0.12)',
  emptyStateDot: 'rgba(255,255,255,0.40)',
  /*
   * heroGradePresets — gradient stop values for each sleep grade
   *
   * primary:      radial gradient 0% stop — 60% grade color + 40% #2D7A3A blend
   * mid:          radial gradient 70% stop — fixed dark forest anchor (#0A1A0E)
   * end:          radial gradient 100% stop — black floor
   * overlayStart: linear overlay 0% stop — fixed atmospheric tint (#4CAF6A)
   * overlayEnd:   linear overlay 61% stop — black fade floor
   */
  heroGradePresets: {
    // Green-family grades — forest-night atmosphere (green mid + green overlay)
    Excellent: {
      primary: '#5B529F',
      mid: '#0B0A1A',
      end: '#000000',
      overlayStart: '#4A45A0',
      overlayEnd: '#000000',
    },
    Great: {
      primary: '#1D8B41',
      mid: '#0A1A0E',
      end: '#000000',
      overlayStart: '#4CAF6A',
      overlayEnd: '#000000',
    },
    Good: {
      primary: '#3A6B21',
      mid: '#0A1A0E',
      end: '#000000',
      overlayStart: '#4CAF6A',
      overlayEnd: '#000000',
    },
    // Warm-family grades — amber / red atmosphere (no green)
    Fair: {
      primary: '#A48023',
      mid: '#1A1400',
      end: '#000000',
      overlayStart: '#7A6020',
      overlayEnd: '#000000',
    },
    Poor: {
      primary: '#AB4E46',
      mid: '#1A0808',
      end: '#000000',
      overlayStart: '#7A3A35',
      overlayEnd: '#000000',
    },
    Bad: {
      primary: '#8D372D',
      mid: '#180808',
      end: '#000000',
      overlayStart: '#6A2A22',
      overlayEnd: '#000000',
    },
    Terrible: {
      primary: '#853A21',
      mid: '#160A04',
      end: '#000000',
      overlayStart: '#622A14',
      overlayEnd: '#000000',
    },
    Empty: {
      primary: '#3A3A3D',
      mid: '#1E1E21',
      end: '#000000',
      overlayStart: '#54545A',
      overlayEnd: '#09090B',
    },
  },
} as const;

export type SleepTheme = typeof SLEEP_THEME;

export const SLEEP_LAYOUT = {
  screenPaddingH: 16,
  heroHeight: 356,
  heroTextPaddingTop: 48,
  heroTextPaddingH: 16,
  chartOverlap: 18,
  chartHeight: 118,
  cardGap: 12,
  cardRadiusInner: 16,
  cardRadiusOuter: 20,
  cardPadding: 18,
  navbarHeight: 72,
  navbarBottom: 10,
  navbarSideMargin: 30,
  scrollBottomPad: 112,
  dotSize: 8,
  dotSizeToday: 12,
  dotGlowSize: 20,
  dividerHeightRatio: 0.65,
} as const;

export const SLEEP_FONTS = {
  regular: 'DMSans-Regular',
  medium: 'DMSans-Medium',
  semiBold: 'DMSans-SemiBold',
  bold: 'DMSans-Bold',
} as const;
