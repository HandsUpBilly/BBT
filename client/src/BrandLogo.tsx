import turn16Badge from './assets/brand/turn16-badge.webp';
import turn16Wordmark from './assets/brand/turn16-wordmark.webp';
import './BrandLogo.css';

interface Props {
  variant: 'wordmark' | 'badge';
  className?: string;
  decorative?: boolean;
}

const SOURCES = {
  wordmark: turn16Wordmark,
  badge: turn16Badge,
} as const;

export function BrandLogo({ variant, className = '', decorative = false }: Props) {
  return (
    <img
      className={`brand-logo brand-logo--${variant}${className ? ` ${className}` : ''}`}
      src={SOURCES[variant]}
      alt={decorative ? '' : 'Turn 16'}
      aria-hidden={decorative || undefined}
    />
  );
}
