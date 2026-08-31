import type { Scenario } from './types';
import { tutorialLessonFor } from './tutorialLessons';
import type { TutorialDrillRecap } from './tutorialRecap';
import { UI_COPY } from './uiCopy';
import './TutorialPuzzleChooser.css';

interface Props {
  seriesName: string;
  scenarios: readonly Scenario[];
  completedScenarioIds: ReadonlySet<string>;
  recaps?: Readonly<Record<string, TutorialDrillRecap>>;
  onChoose: (scenario: Scenario) => void;
  onLeaderboard: (scenario: Scenario) => void;
  onLeave: () => void;
}

export function TutorialPuzzleChooser({
  seriesName, scenarios, completedScenarioIds, recaps = {}, onChoose, onLeaderboard, onLeave,
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
          Play the drills in any order. Before finishing the series, you can replay
          a completed drill and replace its earlier result. One result from each drill
          combines into the final series score.
        </p>
        <div className="tutorial-chooser__progress" role="status">
          {completed} complete · {remaining} remaining
        </div>
      </header>

      <div className="tutorial-chooser__grid">
        {scenarios.map((scenario, index) => {
          const isComplete = completedScenarioIds.has(scenario.id);
          const lesson = tutorialLessonFor(scenario.id);
          const recap = recaps[scenario.id];
          return (
            <article
              key={scenario.id}
              className={`tutorial-chooser__card${isComplete ? ' tutorial-chooser__card--complete' : ''}`}
            >
              <div className="tutorial-chooser__top">
                <div className="tutorial-chooser__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="tutorial-chooser__card-copy">
                  <p className="tutorial-chooser__lesson">{lesson?.title ?? 'Open play'}</p>
                  <h2>{scenario.name}</h2>
                  <p>{scenario.description}</p>
                  {recap && (
                    <section className="tutorial-chooser__recap" aria-label={`${scenario.name} last run recap`}>
                      <strong>Last run</strong>
                      <ol>{recap.actions.map((action, actionIndex) => <li key={`${action}-${actionIndex}`}>{action}</li>)}</ol>
                      <span>Final probability {Math.round(recap.probability * 100)}%</span>
                    </section>
                  )}
                </div>
              </div>
              <div className="tutorial-chooser__actions">
                <button
                  type="button"
                  className={`btn ${isComplete ? 'btn--secondary' : 'btn--primary'}`}
                  onClick={() => onChoose(scenario)}
                >
                  {isComplete ? 'Replay' : 'Play'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => onLeaderboard(scenario)}
                  aria-label={`${UI_COPY.landing.rankings} for ${scenario.name}`}
                >
                  {UI_COPY.landing.rankings}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
