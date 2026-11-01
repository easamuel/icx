import React from 'react';

interface IcxLogoProps {
  variant?: 'sand-on-slate' | 'slate-on-sand';
  className?: string;
}

/**
 * Vector reproduction of the official ICX Studios identity mark
 * (Aperture 'C' + Diagonal 'X' Slash + STUDIOS submark).
 */
export function IcxLogo({
  variant = 'sand-on-slate',
  className = 'h-9 w-auto',
}: IcxLogoProps) {
  const fill = variant === 'sand-on-slate' ? '#E8DEC8' : '#2A3439';

  return (
    <svg
      viewBox="0 0 260 95"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ICX Studios"
    >
      {/* Letter I */}
      <rect x="10" y="18" width="14" height="54" fill={fill} />

      {/* Letter C with camera aperture blades inside */}
      <path
        d="M94 28C87.5 20.5 77.8 16 67 16C47.1 16 31 32.1 31 52C31 71.9 47.1 88 67 88C78.2 88 88.2 83.2 94.6 75.2L84.2 66.8C80.1 71.8 73.9 75 67 75C54.3 75 44 64.7 44 52C44 39.3 54.3 29 67 29C73.6 29 79.6 31.9 83.7 36.6L94 28Z"
        fill={fill}
      />
      {/* Aperture inner blades */}
      <polygon points="56,38 74,38 68,46 52,46" fill={fill} fillOpacity="0.85" />
      <polygon points="49,50 61,42 63,56 49,58" fill={fill} fillOpacity="0.7" />
      <polygon points="64,58 78,52 74,66 58,64" fill={fill} fillOpacity="0.85" />

      {/* Letter X with signature extended diagonal slash */}
      <polygon points="108,18 123,18 140,42 132,52" fill={fill} />
      <polygon points="148,54 156,44 176,72 161,72" fill={fill} />
      <polygon points="196,4 112,92 128,84 196,4" fill={fill} />
      <polygon points="184,12 196,4 126,85 112,92" fill={fill} />

      {/* STUDIOS wordmark */}
      <text
        x="138"
        y="84"
        fill={fill}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="11.5"
        letterSpacing="1.6"
      >
        STUDIOS
      </text>
    </svg>
  );
}

