import type { CSSProperties } from 'react';

/** Gritty leather-ball SVG shared by the pitch marker and the touchdown dialog. */
export function BallIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ball body */}
      <ellipse cx="8" cy="8" rx="5.5" ry="3.5" fill="#c8732a" stroke="#7a3a0a" strokeWidth="0.8" transform="rotate(-30 8 8)" />
      {/* Laces */}
      <line x1="8" y1="5.5" x2="8" y2="10.5" stroke="white" strokeWidth="0.7" strokeLinecap="round" transform="rotate(-30 8 8)" />
      <line x1="6.5" y1="7"  x2="9.5" y2="7"  stroke="white" strokeWidth="0.5" strokeLinecap="round" transform="rotate(-30 8 8)" />
      <line x1="6.5" y1="8.5" x2="9.5" y2="8.5" stroke="white" strokeWidth="0.5" strokeLinecap="round" transform="rotate(-30 8 8)" />
    </svg>
  );
}
