import type { Config } from 'tailwindcss';
import { ICX_COLORS } from '@icx/ui-core';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        icx: {
          slate: {
            DEFAULT: ICX_COLORS.deepSlate, // #2A3439
            dark: ICX_COLORS.workspaceDark, // #1F262A
            elevated: ICX_COLORS.slateElevated, // #344046
            border: ICX_COLORS.slateBorder, // #3E4C53
          },
          sand: {
            DEFAULT: ICX_COLORS.warmSand, // #E8DEC8
            light: ICX_COLORS.workspaceLight, // #F5EFE3
            muted: ICX_COLORS.sandMuted, // #B8B09E
          },
          success: ICX_COLORS.status.success, // #10B981
          warning: ICX_COLORS.status.warning, // #F59E0B
          error: ICX_COLORS.status.error, // #EF4444
        },
      },
      screens: {
        xs: '360px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;

