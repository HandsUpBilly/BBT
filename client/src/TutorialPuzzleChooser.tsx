import type { Scenario } from './types';
import { tutorialLessonFor } from './tutorialLessons';
import './TutorialPuzzleChooser.css';

interface Props {
  seriesName: string;
  scenarios: readonly Scenario[];
  completedScenarioIds: ReadonlySet<string>;
  onChoose: (scenario: Scenario) => void;
  onLeave: () => void;
}

export function TutorialPuzzleChooser({
  seriesName, scenarios, completedScenarioIds, onChoose, onLeave,
}: Props) {
  const completed = scenarios.filter(scenario => completedScenarioIds.has(scenario.id)).length;
  const remaining = scenarios.length - completed;

  return (
    <main className="tutorial-chooser">
      <header className="tutorial-chooser__header">
        <button type="button" className="lb-back-btn" onClick={onLeave}>← Main menu</button>
        <p className="tutorial-chooser__eyebrow">{seriesName}</p>
        <h1>Choose a Tutorial drill</h1>
        <p>
          Play the drills in any order. Complete each one once to finish the series;
          your six probabilities still combine into the final series score.
        </p>
        <div className="tutorial-chooser__progress" role="status">
          {completed} complete · {remaining} remaining
        </div>
      </header>

      <div className="tutorial-chooser__grid">
        {scenarios.map((scenario, index) => {
          const isComplete = completedScenarioIds.has(scenario.id);
          const lesson = tutorialLessonFor(scenario.id);
          return (
            <article
              key={scenario.id}
              className={`tutorial-chooser__card${isComplete ? ' tutorial-chooser__card--complete' : ''}`}
            >
              <div className="tutorial-chooser__number" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="tutorial-chooser__card-copy">
                <p className="tutorial-chooser__lesson">{lesson?.title ?? 'Open play'}</p>
                <h2>{scenario.name}</h2>
                <p>{scenario.description}</p>
              </div>
              <button
                type="button"
                className={`btn ${isComplete ? 'btn--secondary' : 'btn--primary'}`}
                disabled={isComplete}
                onClick={() => onChoose(scenario)}
              >
                {isComplete ? 'Completed' : 'Play this drill'}
              </button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
