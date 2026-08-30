import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { placeMenuBesideAnchor } from './menuPosition';
import type { MenuAnchor } from './menuPosition';
import type { TutorialConcept } from './tutorialConcepts';
import './TutorialContextCaption.css';

interface Props {
  concept: TutorialConcept;
  menuAnchor?: MenuAnchor;
  onDismiss: () => void;
}

const MENU_WIDTH = 260;
const MENU_ESTIMATED_HEIGHT = 210;
const COMPANION_GAP = 12;

export function TutorialContextCaption({ concept, menuAnchor, onDismiss }: Props) {
  const captionRef = useRef<HTMLElement>(null);
  const [attachedPosition, setAttachedPosition] = useState<CSSProperties>();

  useLayoutEffect(() => {
    if (concept.anchor !== 'action-menu' || !menuAnchor) return;
    const placeCaption = () => {
      if (!captionRef.current) return;
      const caption = captionRef.current.getBoundingClientRect();
      const menu = placeMenuBesideAnchor(
        menuAnchor,
        MENU_WIDTH,
        MENU_ESTIMATED_HEIGHT,
        window.innerWidth,
        window.innerHeight,
      );
      const rightOfMenu = menu.left + MENU_WIDTH + COMPANION_GAP;
      const leftOfMenu = menu.left - caption.width - COMPANION_GAP;
      const left = rightOfMenu + caption.width <= window.innerWidth - 8
        ? rightOfMenu
        : Math.max(8, leftOfMenu);
      const top = Math.max(84, Math.min(
        menu.top,
        window.innerHeight - caption.height - 8,
      ));
      setAttachedPosition({ left, top, right: 'auto', bottom: 'auto' });
    };
    placeCaption();
    window.addEventListener('resize', placeCaption);
    return () => window.removeEventListener('resize', placeCaption);
  }, [concept.anchor, menuAnchor]);

  return (
    <aside
      ref={captionRef}
      className={`tutorial-context-caption tutorial-context-caption--${concept.anchor}`}
      data-piece-menu-companion="true"
      style={attachedPosition}
      aria-label={`${concept.title} guidance`}
    >
      <span className="tutorial-context-caption__label">New concept</span>
      <strong>{concept.title}</strong>
      <p>{concept.explanation}</p>
      <p className="tutorial-context-caption__suggestion">Next: {concept.suggestion}</p>
      <button type="button" onClick={onDismiss}>Dismiss</button>
    </aside>
  );
}
