/**
 * ICX STUDIOS OFFICIAL BRAND DESIGN SYSTEM & UI/UX TOKENS
 * Strictly derived from LearnArk Technology Limited / ICX Studios identity assets.
 */

export const ICX_COLORS = {
  /** Primary Deep Slate (Dark Neutral / Core Surface) - RGB(42, 52, 57) */
  deepSlate: '#2A3439',
  /** Warm Sand / Studio Ecru (Light Neutral / Accent Surface) - RGB(232, 222, 200) */
  warmSand: '#E8DEC8',
  /** Card / Workspace Dark */
  workspaceDark: '#1F262A',
  /** Card / Workspace Light */
  workspaceLight: '#F5EFE3',
  /** Elevated Slate Surface */
  slateElevated: '#344046',
  /** Muted Slate Border */
  slateBorder: '#3E4C53',
  /** Muted Sand Text */
  sandMuted: '#B8B09E',
  /** Status & Feedback Tokens */
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
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
    maximumFractionDigits: 2,
  }).format(naira);
}

