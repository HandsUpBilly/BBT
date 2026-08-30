import type { TutorialLesson } from './tutorialLessons';
import './TutorialObjectiveCard.css';

interface Props {
  lesson: TutorialLesson;
  objective: string;
  onDismiss: () => void;
}

export function TutorialObjectiveCard({ lesson, objective, onDismiss }: Props) {
  const concept = lesson.paragraphs.find(paragraph => !paragraph.startsWith('OBJECTIVE:') && !paragraph.startsWith('SCORE:'));
  return (
    <aside className="tutorial-objective-card" aria-label="Tutorial drill objective">
      <span>Drill objective</span>
      <strong>{lesson.title}</strong>
      <p>{objective}</p>
      {concept && <p className="tutorial-objective-card__concept">{concept}</p>}
      <button type="button" onClick={onDismiss} aria-label="Dismiss drill objective">×</button>
    </aside>
  );
}
