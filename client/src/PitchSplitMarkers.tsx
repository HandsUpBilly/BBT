import { useEffect, useRef, useState } from 'react';
import type { BlockOutcomeFace } from './types';
import type { BranchTreeBlockView } from './branchRun';
import { BlockFaceGraphic } from './BlockDiceGraphic';
import { BLOCK_FACE_LABELS } from './blockDiceAssets';
import { pitchSplitPoints } from './pitchSplitPoints';
import type { PitchOrientation } from './Pitch';
import './PitchSplitMarkers.css';

interface Props {
  tree: BranchTreeBlockView | null;
  orientation: PitchOrientation;
  acrossValues: readonly number[];
  downValues: readonly number[];
  onSelect: (id: string) => void;
}

const STATUS: Record<string, string> = {
  scored: 'Scored',
  conceded: 'Failed',
  'needs-attention': 'Needs attention',
  authoring: 'In progress',
  continued: 'More splits',
};

function faceNames(faces: readonly BlockOutcomeFace[]): string {
  return faces.map(face => BLOCK_FACE_LABELS[face]).join(' or ');
}

/** Navigation sits over the grid, so it never replaces a playable square. */
export function PitchSplitMarkers({ tree, orientation, acrossValues, downValues, onSelect }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const markers = pitchSplitPoints(tree);
  // A removed split must not leave its popover on screen. Derive visibility
  // from the current tree instead of setting state during an effect.
  const activeOpenId = markers.some(marker => marker.id === openId) ? openId : null;

  useEffect(() => {
    if (!activeOpenId) return;
    const dismiss = (event: PointerEvent) => {
      if (!layerRef.current?.contains(event.target as Node)) setOpenId(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // The app also uses Escape to cancel a player's pending activation.
        // Closing this overlay must not discard gameplay underneath it.
        event.stopPropagation();
        setOpenId(null);
      }
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [activeOpenId]);

  if (markers.length === 0) return null;

  const positionsSeen = new Map<string, number>();
  return (
    <div className="pitch-splits" ref={layerRef} aria-label="Split point navigation">
      {markers.map(marker => {
        const across = orientation === 'portrait' ? marker.position.col : marker.position.row;
        const down = orientation === 'portrait' ? marker.position.row : marker.position.col;
        const acrossIndex = acrossValues.indexOf(across);
        const downIndex = downValues.indexOf(down);
        if (acrossIndex < 0 || downIndex < 0) return null;

        const coordinate = `${acrossIndex},${downIndex}`;
        const stack = positionsSeen.get(coordinate) ?? 0;
        positionsSeen.set(coordinate, stack + 1);
        const x = ((acrossIndex + 0.8) / acrossValues.length) * 100;
        const y = ((downIndex + 0.18) / downValues.length) * 100;
        const side = x < 34 ? 'left' : x > 66 ? 'right' : 'center';
        const vertical = y > 50 ? 'up' : 'down';
        const isOpen = activeOpenId === marker.id;
        const title = `Split ${marker.number}: ${marker.blockLabel}`;
        return (
          <div
            className={`pitch-split-point pitch-split-point--${side} pitch-split-point--${vertical}`}
            key={marker.id}
            style={{ left: `calc(${x}% + ${stack * 24}px)`, top: `${y}%` }}
          >
            <button
              type="button"
              className={`pitch-split-point__trigger${isOpen ? ' pitch-split-point__trigger--open' : ''}`}
              aria-label={`${title}. Switch between ${marker.choices.length} outcomes`}
              aria-expanded={isOpen}
              aria-controls={`pitch-split-options-${marker.id}`}
              title={title}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => {
                event.stopPropagation();
                setOpenId(isOpen ? null : marker.id);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 12h5m0 0V5m0 7v7m0-14h4m-4 14h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="17" cy="5" r="2.2" fill="currentColor" />
                <circle cx="17" cy="19" r="2.2" fill="currentColor" />
              </svg>
              <span>{marker.choices.length}</span>
            </button>
            {isOpen && (
              <div
                className="pitch-split-point__popover"
                role="group"
                id={`pitch-split-options-${marker.id}`}
                aria-label={`${title} dice outcomes`}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => event.stopPropagation()}
              >
                <div className="pitch-split-point__heading">
                  <div>
                    <strong>Split {marker.number}</strong>
                    <span>{marker.blockLabel}</span>
                  </div>
                  <button
                    type="button"
                    className="pitch-split-point__close"
                    aria-label="Close split outcomes"
                    onClick={() => setOpenId(null)}
                  >×</button>
                </div>
                <p className="pitch-split-point__hint">
                  {marker.diceCount} {marker.diceCount === 1 ? 'die' : 'dice'} · {marker.picker === 'attacker' ? 'You choose' : 'Opponent chooses'}
                </p>
                <div className="pitch-split-point__choices">
                  {marker.choices.map(choice => (
                    <button
                      type="button"
                      key={choice.id}
                      className={`pitch-split-point__choice${choice.isCurrent ? ' pitch-split-point__choice--current' : ''}`}
                      aria-current={choice.isCurrent ? 'true' : undefined}
                      aria-label={`${choice.label}, ${faceNames(choice.faces)}. Go to universe ${choice.universe}. ${STATUS[choice.status]}`}
                      onClick={() => {
                        setOpenId(null);
                        onSelect(choice.targetId);
                      }}
                    >
                      <span className="pitch-split-point__faces" aria-hidden="true">
                        {choice.faces.map(face => (
                          <BlockFaceGraphic key={face} face={face} favor={marker.picker} size={22} />
                        ))}
                      </span>
                      <span className="pitch-split-point__choice-label">
                        <strong>{choice.label}</strong>
                        <small>Universe {choice.universe} · {STATUS[choice.status]}</small>
                      </span>
                      {choice.isCurrent && <span className="pitch-split-point__current">Viewing</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
