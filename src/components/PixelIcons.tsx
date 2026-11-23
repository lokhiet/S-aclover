import React from 'react';

interface PixelIconProps {
  className?: string;
}

/** Crisp 16x16 four-leaf clover pixel icon for the retro window title bar */
export function PixelCloverIcon({ className = 'w-4 h-4' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {/* Top-left leaf */}
      <rect x="3" y="2" width="3" height="1" fill="#39755D" />
      <rect x="2" y="3" width="5" height="3" fill="#52A37E" />
      <rect x="3" y="3" width="2" height="1" fill="#9FE0BE" />
      <rect x="3" y="6" width="4" height="1" fill="#39755D" />
      {/* Top-right leaf */}
      <rect x="10" y="2" width="3" height="1" fill="#39755D" />
      <rect x="9" y="3" width="5" height="3" fill="#52A37E" />
      <rect x="10" y="3" width="2" height="1" fill="#9FE0BE" />
      <rect x="9" y="6" width="4" height="1" fill="#39755D" />
      {/* Bottom-left leaf */}
      <rect x="2" y="8" width="5" height="3" fill="#46916E" />
      <rect x="3" y="8" width="2" height="1" fill="#82CBA6" />
      <rect x="3" y="11" width="3" height="1" fill="#39755D" />
      {/* Bottom-right leaf */}
      <rect x="9" y="8" width="5" height="3" fill="#46916E" />
      <rect x="10" y="8" width="2" height="1" fill="#82CBA6" />
      <rect x="10" y="11" width="3" height="1" fill="#39755D" />
      {/* Center & stem */}
      <rect x="7" y="6" width="2" height="3" fill="#2B5B47" />
      <rect x="7" y="9" width="2" height="4" fill="#39755D" />
      <rect x="8" y="13" width="2" height="1" fill="#2B5B47" />
    </svg>
  );
}

/** Crisp 16x16 pixel character portrait icon (Nhân Vật) */
export function PixelCharacterIcon({ className = 'w-4 h-4' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {/* Hair & head outline */}
      <rect x="5" y="2" width="6" height="1" fill="#2B5B47" />
      <rect x="4" y="3" width="8" height="2" fill="#39755D" />
      <rect x="4" y="5" width="1" height="4" fill="#2B5B47" />
      <rect x="11" y="5" width="1" height="4" fill="#2B5B47" />
      {/* Face */}
      <rect x="5" y="5" width="6" height="4" fill="#FFF2D6" />
      {/* Eyes */}
      <rect x="6" y="6" width="1" height="1" fill="#2B5B47" />
      <rect x="9" y="6" width="1" height="1" fill="#2B5B47" />
      {/* Rosy cheeks */}
      <rect x="5" y="7" width="1" height="1" fill="#ECABC2" />
      <rect x="10" y="7" width="1" height="1" fill="#ECABC2" />
      {/* Chin */}
      <rect x="5" y="9" width="6" height="1" fill="#2B5B47" />
      {/* Collar & shoulders */}
      <rect x="3" y="11" width="10" height="3" fill="#6BB695" />
      <rect x="4" y="10" width="8" height="1" fill="#39755D" />
      <rect x="7" y="11" width="2" height="1" fill="#F2CDDA" />
      <rect x="2" y="12" width="1" height="2" fill="#2B5B47" />
      <rect x="13" y="12" width="1" height="2" fill="#2B5B47" />
      <rect x="3" y="14" width="10" height="1" fill="#2B5B47" />
    </svg>
  );
}

/** Crisp 16x16 pixel notebook/book icon (Tác Giả) */
export function PixelAuthorIcon({ className = 'w-4 h-4' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {/* Book cover */}
      <rect x="3" y="2" width="10" height="1" fill="#2B5B47" />
      <rect x="2" y="3" width="1" height="10" fill="#2B5B47" />
      <rect x="13" y="3" width="1" height="10" fill="#2B5B47" />
      <rect x="3" y="13" width="10" height="1" fill="#2B5B47" />
      {/* Spine */}
      <rect x="3" y="3" width="2" height="10" fill="#39755D" />
      {/* Cream cover */}
      <rect x="5" y="3" width="8" height="10" fill="#FFF9EA" />
      {/* Ribbon bookmark */}
      <rect x="10" y="3" width="2" height="4" fill="#E89CB7" />
      <rect x="10" y="7" width="1" height="1" fill="#E89CB7" />
      {/* Title lines */}
      <rect x="6" y="5" width="3" height="1" fill="#39755D" />
      <rect x="6" y="7" width="3" height="1" fill="#7AB59A" />
      <rect x="6" y="9" width="5" height="1" fill="#7AB59A" />
      <rect x="6" y="11" width="4" height="1" fill="#A6CEBC" />
    </svg>
  );
}

/** Crisp 16x16 pixel retro window / prompt icon (Kho Lệnh) */
export function PixelCommandIcon({ className = 'w-4 h-4' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {/* Window border */}
      <rect x="2" y="2" width="12" height="1" fill="#2B5B47" />
      <rect x="1" y="3" width="1" height="10" fill="#2B5B47" />
      <rect x="14" y="3" width="1" height="10" fill="#2B5B47" />
      <rect x="2" y="13" width="12" height="1" fill="#2B5B47" />
      {/* Title bar */}
      <rect x="2" y="3" width="12" height="2" fill="#8FD0B0" />
      <rect x="2" y="5" width="12" height="1" fill="#39755D" />
      <rect x="12" y="3" width="1" height="1" fill="#FFF9EA" />
      {/* Screen interior */}
      <rect x="2" y="6" width="12" height="7" fill="#FFF9EA" />
      {/* Prompt >_ */}
      <rect x="4" y="8" width="1" height="1" fill="#39755D" />
      <rect x="5" y="9" width="1" height="1" fill="#39755D" />
      <rect x="4" y="10" width="1" height="1" fill="#39755D" />
      <rect x="7" y="10" width="4" height="1" fill="#529E7C" />
    </svg>
  );
}

/** Crisp 16x16 pixel lightbulb icon (Kho Idea) */
export function PixelIdeaIcon({ className = 'w-4 h-4' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {/* Rays */}
      <rect x="7" y="1" width="2" height="1" fill="#E3B34C" />
      <rect x="2" y="5" width="1" height="1" fill="#E3B34C" />
      <rect x="13" y="5" width="1" height="1" fill="#E3B34C" />
      {/* Bulb outline */}
      <rect x="5" y="3" width="6" height="1" fill="#39755D" />
      <rect x="4" y="4" width="1" height="4" fill="#39755D" />
      <rect x="11" y="4" width="1" height="4" fill="#39755D" />
      <rect x="5" y="8" width="1" height="2" fill="#39755D" />
      <rect x="10" y="8" width="1" height="2" fill="#39755D" />
      {/* Warm cream-yellow glow fill */}
      <rect x="5" y="4" width="6" height="4" fill="#FCE28B" />
      <rect x="6" y="8" width="4" height="2" fill="#FCE28B" />
      <rect x="6" y="5" width="2" height="1" fill="#FFFDF4" />
      {/* Base */}
      <rect x="5" y="10" width="6" height="1" fill="#39755D" />
      <rect x="6" y="11" width="4" height="2" fill="#9BC4B1" />
      <rect x="6" y="13" width="4" height="1" fill="#2B5B47" />
    </svg>
  );
}

/** Crisp 14x14 pixel magnifier for search */
export function PixelSearchIcon({ className = 'w-3.5 h-3.5' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <rect x="4" y="2" width="4" height="1" fill="currentColor" />
      <rect x="3" y="3" width="1" height="1" fill="currentColor" />
      <rect x="8" y="3" width="1" height="1" fill="currentColor" />
      <rect x="2" y="4" width="1" height="4" fill="currentColor" />
      <rect x="9" y="4" width="1" height="4" fill="currentColor" />
      <rect x="3" y="8" width="1" height="1" fill="currentColor" />
      <rect x="8" y="8" width="1" height="1" fill="currentColor" />
      <rect x="4" y="9" width="4" height="1" fill="currentColor" />
      <rect x="9" y="9" width="2" height="1" fill="currentColor" />
      <rect x="10" y="10" width="2" height="1" fill="currentColor" />
      <rect x="11" y="11" width="1" height="1" fill="currentColor" />
    </svg>
  );
}

/** Crisp 14x14 pixel tag icon */
export function PixelTagIcon({ className = 'w-3.5 h-3.5' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="5" height="1" fill="currentColor" />
      <rect x="2" y="3" width="1" height="4" fill="currentColor" />
      <rect x="4" y="4" width="1" height="1" fill="currentColor" />
      <rect x="7" y="3" width="1" height="1" fill="currentColor" />
      <rect x="8" y="4" width="1" height="1" fill="currentColor" />
      <rect x="9" y="5" width="1" height="1" fill="currentColor" />
      <rect x="10" y="6" width="1" height="1" fill="currentColor" />
      <rect x="11" y="7" width="1" height="2" fill="currentColor" />
      <rect x="3" y="7" width="1" height="1" fill="currentColor" />
      <rect x="4" y="8" width="1" height="1" fill="currentColor" />
      <rect x="5" y="9" width="1" height="1" fill="currentColor" />
      <rect x="6" y="10" width="1" height="1" fill="currentColor" />
      <rect x="7" y="11" width="2" height="1" fill="currentColor" />
      <rect x="9" y="10" width="1" height="1" fill="currentColor" />
      <rect x="10" y="9" width="1" height="1" fill="currentColor" />
    </svg>
  );
}

/** Retro 24x20 pixel desktop folder icon for the 4 shortcuts inside the welcome letter */
export function PixelFolderShortcutIcon({
  variant,
  className = 'w-9 h-8',
}: {
  variant: 'characters' | 'authors' | 'notes' | 'ideas';
  className?: string;
}) {
  const palette = {
    characters: {
      tab: '#B8E0C9',
      body: '#E2F3E8',
      shade: '#CBE8D6',
      accent: '#E8A8BE',
    },
    authors: {
      tab: '#F2CDDA',
      body: '#FAEAF0',
      shade: '#F2D6E0',
      accent: '#39755D',
    },
    notes: {
      tab: '#A9D9BF',
      body: '#D8EFE1',
      shade: '#BFE2CD',
      accent: '#39755D',
    },
    ideas: {
      tab: '#F5DF9D',
      body: '#FDF3D3',
      shade: '#F5E3AC',
      accent: '#39755D',
    },
  }[variant];

  return (
    <svg
      viewBox="0 0 24 20"
      fill="none"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {/* Folder tab outline */}
      <rect x="2" y="2" width="7" height="1" fill="#39755D" />
      <rect x="1" y="3" width="1" height="14" fill="#39755D" />
      <rect x="9" y="3" width="1" height="1" fill="#39755D" />
      <rect x="10" y="4" width="12" height="1" fill="#39755D" />
      {/* Tab fill */}
      <rect x="2" y="3" width="7" height="2" fill={palette.tab} />
      <rect x="2" y="3" width="7" height="1" fill="#FFFFFF" fillOpacity="0.45" />
      {/* Inner paper peek */}
      <rect x="4" y="5" width="16" height="2" fill="#FFF9EA" />
      <rect x="4" y="5" width="16" height="1" fill="#39755D" fillOpacity="0.2" />
      {/* Front folder flap */}
      <rect x="2" y="6" width="20" height="1" fill="#39755D" />
      <rect x="2" y="7" width="20" height="10" fill={palette.body} />
      <rect x="2" y="7" width="20" height="1" fill="#FFFFFF" fillOpacity="0.6" />
      <rect x="2" y="15" width="20" height="2" fill={palette.shade} />
      {/* Outer right & bottom border */}
      <rect x="22" y="5" width="1" height="12" fill="#39755D" />
      <rect x="2" y="17" width="20" height="1" fill="#39755D" />
      {/* Subtle bottom drop pixel shadow */}
      <rect x="3" y="18" width="20" height="1" fill="#39755D" fillOpacity="0.18" />

      {/* Tiny pixel emblem inside folder front */}
      {variant === 'characters' && (
        <>
          <rect x="10" y="9" width="4" height="3" fill="#39755D" />
          <rect x="11" y="10" width="2" height="1" fill="#FFF9EA" />
          <rect x="9" y="13" width="6" height="2" fill={palette.accent} />
        </>
      )}
      {variant === 'authors' && (
        <>
          <rect x="9" y="9" width="6" height="6" fill="#39755D" />
          <rect x="10" y="10" width="4" height="4" fill="#FFF9EA" />
          <rect x="11" y="11" width="2" height="1" fill="#E89CB7" />
          <rect x="11" y="13" width="2" height="1" fill="#39755D" />
        </>
      )}
      {variant === 'notes' && (
        <>
          <rect x="9" y="10" width="1" height="1" fill="#39755D" />
          <rect x="10" y="11" width="1" height="1" fill="#39755D" />
          <rect x="9" y="12" width="1" height="1" fill="#39755D" />
          <rect x="12" y="12" width="4" height="1" fill="#39755D" />
        </>
      )}
      {variant === 'ideas' && (
        <>
          <rect x="10" y="9" width="4" height="3" fill="#39755D" />
          <rect x="11" y="10" width="2" height="1" fill="#FFFDF4" />
          <rect x="11" y="12" width="2" height="2" fill="#39755D" />
          <rect x="11" y="14" width="2" height="1" fill="#B59340" />
        </>
      )}
    </svg>
  );
}

/** Delicate Japanese postmark stamp reading "おてがみ" beside the postage stamp */
export function OtegamiPostmark({ className = 'w-20 h-20' }: PixelIconProps) {
  return (
    <svg
      viewBox="0 0 96 76"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Wavy postal cancellation lines trailing to the left */}
      <g
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.48"
      >
        <path d="M4 26 Q 11 22, 18 26 T 32 26" />
        <path d="M2 35 Q 9 31, 16 35 T 30 35" />
        <path d="M4 44 Q 11 40, 18 44 T 32 44" />
        <path d="M7 53 Q 14 49, 21 53 T 34 53" />
      </g>

      {/* Circular Japanese postmark */}
      <g transform="translate(59, 38) rotate(-8)">
        <circle
          cx="0"
          cy="0"
          r="27"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.72"
        />
        <circle
          cx="0"
          cy="0"
          r="23"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeDasharray="2 2"
          opacity="0.55"
        />
        {/* Horizontal date bars */}
        <line
          x1="-22"
          y1="-8"
          x2="22"
          y2="-8"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.65"
        />
        <line
          x1="-22"
          y1="9"
          x2="22"
          y2="9"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.65"
        />
        {/* Top micro label */}
        <text
          x="0"
          y="-13"
          textAnchor="middle"
          fill="currentColor"
          fontSize="6.2"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="0.14em"
          opacity="0.78"
        >
          CLOVER
        </text>
        {/* Main Japanese postmark label */}
        <text
          x="0"
          y="4.2"
          textAnchor="middle"
          fill="currentColor"
          fontSize="10.2"
          fontWeight="600"
          letterSpacing="0.06em"
          opacity="0.9"
        >
          おてがみ
        </text>
        {/* Bottom micro mark */}
        <text
          x="0"
          y="18.5"
          textAnchor="middle"
          fill="currentColor"
          fontSize="5.8"
          fontFamily="JetBrains Mono, monospace"
          letterSpacing="0.12em"
          opacity="0.72"
        >
          POST
        </text>
      </g>
    </svg>
  );
}
