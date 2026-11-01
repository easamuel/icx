/**
 * ICX STUDIOS — ARCHITECTURAL MONOCHROME BLACK & WHITE DESIGN SYSTEM
 * Pure White (#FFFFFF) & Alabaster (#FAFAFA) studio surfaces paired with
 * Obsidian Black (#09090B) typography, razor-sharp borders (#E4E4E7), and high-contrast accents.
 */

export const ICX_COLORS = {
  /** Primary Studio Surface (Pure White) */
  deepSlate: '#FFFFFF',
  /** Primary Ink / Solid Action Surface (Obsidian Black) */
  warmSand: '#09090B',
  /** Card / Secondary Alabaster Surface */
  workspaceDark: '#FAFAFA',
  /** Hover / Accent Ink Surface */
  workspaceLight: '#27272A',
  /** Selected / Elevated Card Surface */
  slateElevated: '#F4F4F5',
  /** Architectural 1px Hairline Border */
  slateBorder: '#E4E4E7',
  /** High-Contrast Secondary Charcoal Text */
  sandMuted: '#52525B',
  /** Status & Semantic Feedback Tokens */
  status: {
    success: '#059669',
    warning: '#D97706',
    error: '#DC2626',
  },
} as const;

export const ICX_TAILWIND_THEME_EXTEND = {
  colors: {
    icx: {
      slate: {
        DEFAULT: ICX_COLORS.deepSlate,
        dark: ICX_COLORS.workspaceDark,
        elevated: ICX_COLORS.slateElevated,
        border: ICX_COLORS.slateBorder,
      },
      sand: {
        DEFAULT: ICX_COLORS.warmSand,
        light: ICX_COLORS.workspaceLight,
        muted: ICX_COLORS.sandMuted,
      },
      success: ICX_COLORS.status.success,
      warning: ICX_COLORS.status.warning,
      error: ICX_COLORS.status.error,
    },
  },
  screens: {
    xs: '360px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

/**
 * Formats integer kobo/subunit or Naira integer values cleanly in NGN (₦)
 */
export function formatNaira(amountInKoboOrNaira: string | number | bigint, isKobo = true): string {
  const num = Number(amountInKoboOrNaira);
  const naira = isKobo ? num / 100 : num;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(naira);
}
