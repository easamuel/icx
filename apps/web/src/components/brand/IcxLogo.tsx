import React from 'react';

interface IcxLogoProps {
  variant?: 'sand-on-slate' | 'slate-on-sand' | 'dark' | 'light';
  className?: string;
}

/**
 * Official ICX Studios Architectural Vector Mark
 * Crisp monochrome geometry with precision camera aperture emblem and bold wordmark.
 */
export function IcxLogo({
  variant = 'sand-on-slate',
  className = 'h-9 w-auto',
}: IcxLogoProps) {
  const isLightInk = variant === 'slate-on-sand' || variant === 'light';
  const primary = isLightInk ? '#FFFFFF' : '#09090B';
  const secondary = isLightInk ? '#09090B' : '#FFFFFF';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-9 w-9 shrink-0"
        aria-hidden="true"
      >
        <rect width="44" height="44" rx="10" fill={primary} />
        {/* Precision Aperture Ring */}
        <circle
          cx="22"
          cy="22"
          r="12.5"
          stroke={secondary}
          strokeWidth="2.2"
        />
        {/* Shutter Blades */}
        <path
          d="M22 9.5L27.5 18.5H16.5L22 9.5Z"
          fill={secondary}
          fillOpacity="0.9"
        />
        <path
          d="M32.8 15.8L25 24.5L20.5 16.5L32.8 15.8Z"
          fill={secondary}
          fillOpacity="0.65"
        />
        <path
          d="M32.8 28.2L22 28.5L26.5 20.5L32.8 28.2Z"
          fill={secondary}
          fillOpacity="0.9"
        />
        <path
          d="M22 34.5L16.5 25.5H27.5L22 34.5Z"
          fill={secondary}
          fillOpacity="0.65"
        />
        <path
          d="M11.2 28.2L19 19.5L23.5 27.5L11.2 28.2Z"
          fill={secondary}
          fillOpacity="0.9"
        />
        <circle cx="22" cy="22" r="3.8" fill={primary} stroke={secondary} strokeWidth="1.8" />
      </svg>
      <div className="flex flex-col leading-none">
        <span
          className="text-lg font-black tracking-tighter"
          style={{ color: primary }}
        >
          ICX<span className="font-light tracking-tight ml-0.5">ORA</span>
        </span>
        <span
          className="text-[9px] font-bold uppercase tracking-[0.26em] opacity-60 mt-0.5"
          style={{ color: primary }}
        >
          STUDIOS
        </span>
      </div>
    </div>
  );
}
