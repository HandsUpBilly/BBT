import { useState } from 'react';

interface Props {
  name?: string;
  src?: string;
  className: string;
  fallbackClassName: string;
}

function playerInitials(name: string | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Public and local avatars share one reliable broken-image fallback. */
export function PlayerAvatar({ name, src, className, fallbackClassName }: Props) {
  const [failedSrc, setFailedSrc] = useState<string>();
  if (src && failedSrc !== src) {
    return <img className={className} src={src} alt="" onError={() => setFailedSrc(src)} />;
  }
  return <span className={`${className} ${fallbackClassName}`}>{playerInitials(name)}</span>;
}
