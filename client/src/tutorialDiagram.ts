import type { Position } from './types';
import type { TutorialAction } from './tutorialLessons';

export interface TutorialDiagramFocus {
  kind: 'pitch' | 'action' | 'confirmation' | 'probability' | 'universes';
  pieceIds?: readonly string[];
  target?: Position;
  action?: TutorialAction;
  region?: 'end-zone' | 'tackle-zones' | 'receiver' | 'route';
}

export interface TutorialDiagramHint {
  text: string;
  alt: string;
  focus: TutorialDiagramFocus;
}
