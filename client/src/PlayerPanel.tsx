import type { PlayerPiece, Team } from './types';
import { playerPortraitFor } from './playerPortraits';
import './PlayerPanel.css';

interface Props {
  piece: PlayerPiece | null;
  side: 'left' | 'right';
  /**
   * Which half of a two-player action this card is, when two are stacked.
   * Omitted for the ordinary single card — one card needs no label saying it
   * is the one card.
   */
  role?: 'acting' | 'target';
}

const CRESTS: Record<Team, string> = {
  human: '/human-crest.png',
  orc:   '/orc-crest.png',
};

// Stat icons using the token images
const STAT_ICONS: Record<Team, Record<string, string>> = {
  human: {
    ma:  '/human-token-helmet.png',
    st:  '/human-token-exclaim.png',
    ag:  '/human-token-star.png',
    av:  '/human-token-cross.png',
  },
  orc: {
    ma:  '/orc-token-helmet.png',
    st:  '/orc-token-exclaim.png',
    ag:  '/orc-token-burst.png',
    av:  '/orc-token-cross.png',
  },
};

interface StatProps {
  team: Team;
  stat: string;
  label: string;
  value: number;
}

function StatBadge({ team, stat, label, value }: StatProps) {
  const icon = STAT_ICONS[team][stat];
  return (
    <div className="panel__stat">
      <img className="panel__stat-icon" src={icon} alt={label} draggable={false} />
      <span className="panel__stat-value">{value}</span>
      <span className="panel__stat-label">{label}</span>
    </div>
  );
}

export function PlayerPanel({ piece, side, role }: Props) {
  if (!piece) {
    return <div className={`panel panel--${side} panel--empty`} />;
  }

  const portraitSrc = playerPortraitFor(piece.team, piece.role);
  const portraitClass = portraitSrc.includes('-gritty.')
    ? 'panel__portrait'
    : 'panel__portrait panel__portrait--legacy';

  return (
    <div
      className={[
        'panel',
        `panel--${side}`,
        `panel--${piece.team}`,
        role ? `panel--${role}` : '',
      ].filter(Boolean).join(' ')}
    >
      {role && (
        <div className={`panel__role-tag panel__role-tag--${role}`}>
          {role === 'acting' ? 'Acting' : 'Target'}
        </div>
      )}

      {/* Portrait */}
      <div className="panel__portrait-wrap">
        <img
          className={portraitClass}
          src={portraitSrc}
          alt={piece.name}
          draggable={false}
        />
        {piece.hasBall && (
          <img className="panel__ball-badge" src="/human-token-hh.png" alt="ball" draggable={false} />
        )}
        {piece.activated && (
          <div className="panel__activated-overlay">✓</div>
        )}
      </div>

      {/* Name + role */}
      <div className="panel__name">{piece.name}</div>
      <div className="panel__role">{piece.role ?? 'Lineman'}</div>

      {/* Stats */}
      <div className="panel__stats">
        <StatBadge team={piece.team} stat="ma" label="MA" value={piece.ma} />
        <StatBadge team={piece.team} stat="st" label="ST" value={piece.st} />
        <StatBadge team={piece.team} stat="ag" label="AG" value={piece.ag} />
        <StatBadge team={piece.team} stat="av" label="AV" value={piece.av} />
      </div>

      {/* Skills */}
      {piece.skills.length > 0 && (
        <div className="panel__skills">
          {piece.skills.map(s => (
            <span key={s} className="panel__skill">{s}</span>
          ))}
        </div>
      )}

      {/* Crest watermark */}
      <img
        className="panel__crest"
        src={CRESTS[piece.team]}
        alt="crest"
        draggable={false}
      />
    </div>
  );
}
