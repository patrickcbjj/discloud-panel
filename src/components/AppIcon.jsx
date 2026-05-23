import React from 'react';

// Logo oficial do Discloud Panel. Mesmo desenho do build/icon.png (SVG fonte
// em build/icon.html) — renderizado inline pra ficar nítido em qualquer
// tamanho. Usado no modal Sobre, etc.

export default function AppIcon({ size = 56, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ai-bg" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0a0e1c" />
          <stop offset="60%" stopColor="#11132a" />
          <stop offset="100%" stopColor="#181433" />
        </linearGradient>
        <radialGradient id="ai-bloomBlue" cx="55" cy="55" r="170" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5b8def" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#5b8def" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ai-bloomViolet" cx="210" cy="220" r="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#7c5cff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ai-dBody" x1="58" y1="50" x2="200" y2="208" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9cc1ff" />
          <stop offset="40%" stopColor="#5b8def" />
          <stop offset="100%" stopColor="#8c6dff" />
        </linearGradient>
        <linearGradient id="ai-spec" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="ai-dotGlow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" />
        </filter>
        <filter id="ai-dHalo" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" />
        </filter>
        <pattern id="ai-scan" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="1" fill="#ffffff" opacity="0.022" />
        </pattern>
        <clipPath id="ai-rounded">
          <rect x="0" y="0" width="256" height="256" rx="52" ry="52" />
        </clipPath>
        <path
          id="ai-dPath"
          fillRule="evenodd"
          d="M 58 50 L 130 50 C 170 50, 198 78, 198 128 C 198 178, 170 206, 130 206 L 58 206 Z M 92 86 L 130 86 C 154 86, 166 102, 166 128 C 166 154, 154 170, 130 170 L 92 170 Z"
        />
      </defs>

      <g clipPath="url(#ai-rounded)">
        <rect width="256" height="256" fill="url(#ai-bg)" />
        <rect width="256" height="256" fill="url(#ai-bloomBlue)" />
        <rect width="256" height="256" fill="url(#ai-bloomViolet)" />
        <rect width="256" height="256" fill="url(#ai-scan)" />

        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 16 30 L 16 16 L 30 16" stroke="#5b8def" strokeWidth="2.5" opacity="0.72" />
          <path d="M 240 226 L 240 240 L 226 240" stroke="#7c5cff" strokeWidth="2.5" opacity="0.72" />
          <circle cx="240" cy="16" r="1.6" fill="#5b8def" opacity="0.5" />
          <circle cx="16" cy="240" r="1.6" fill="#7c5cff" opacity="0.5" />
        </g>

        <ellipse cx="128" cy="218" rx="68" ry="6" fill="#000000" opacity="0.45" />

        <g opacity="0.55" filter="url(#ai-dHalo)">
          <use href="#ai-dPath" fill="#7c5cff" />
        </g>

        <use href="#ai-dPath" fill="url(#ai-dBody)" />

        <path
          d="M 92 86 L 130 86 C 154 86, 166 102, 166 128"
          fill="none"
          stroke="#000000"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />

        <path
          d="M 66 50 L 130 50 C 162 50, 184 64, 193 86"
          fill="none"
          stroke="url(#ai-spec)"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.9"
        />

        <g>
          <circle cx="129" cy="128" r="22" fill="#22e575" opacity="0.22" filter="url(#ai-dotGlow)" />
          <circle cx="129" cy="128" r="11" fill="#22e575" opacity="0.55" />
          <circle cx="129" cy="128" r="6.5" fill="#3aff8f" />
          <circle cx="127" cy="125.5" r="2.4" fill="#e7ffef" />
        </g>

        <rect
          x="0.5"
          y="0.5"
          width="255"
          height="255"
          rx="51.5"
          ry="51.5"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.09"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
