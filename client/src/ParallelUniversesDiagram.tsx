import './ParallelUniversesDiagram.css';

const ALT_TEXT = 'A Block splits into named outcomes: two that share the same follow-up plan '
  + 'merge back together under Lockstep, while one that needs a different plan waits on the branch '
  + 'strip above the pitch. A second Block then splits the waiting universe again.';

/** Static teaching diagram for the parallel-universes tutorial lesson. No live game state involved. */
export function ParallelUniversesDiagram() {
  return (
    <figure className="pu-diagram">
      <svg
        className="pu-diagram__svg"
        viewBox="0 0 920 320"
        role="img"
        aria-label={ALT_TEXT}
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="pu-diagram__screen" transform="translate(16 14)">
          <rect className="pu-diagram__screen-frame" x="0" y="0" width="230" height="130" rx="8" />
          <text className="pu-diagram__screen-label" x="115" y="17" textAnchor="middle">BRANCH STRIP</text>
          <rect className="pu-diagram__screen-strip" x="6" y="22" width="218" height="24" rx="5" />
          {[0, 1, 2].map(index => (
            <rect
              key={index}
              className="pu-diagram__screen-chip"
              x={11 + index * 73}
              y="27"
              width="66"
              height="14"
              rx="4"
            />
          ))}
          <rect className="pu-diagram__screen-pitch" x="6" y="52" width="218" height="62" rx="5" />
          <text className="pu-diagram__screen-label" x="115" y="86" textAnchor="middle">PITCH</text>
          <text className="pu-diagram__screen-caption" x="0" y="144">① Switch universes here, above the pitch</text>
        </g>

        <g className="pu-diagram__tree" transform="translate(272 10)">
          <rect className="pu-diagram__node pu-diagram__node--block" x="0" y="40" width="76" height="40" rx="6" />
          <text className="pu-diagram__node-text" x="38" y="64" textAnchor="middle">BLOCK</text>

          <path className="pu-diagram__link" d="M 76 60 C 110 60, 110 20, 144 20" />
          <path className="pu-diagram__link" d="M 76 60 L 144 60" />
          <path className="pu-diagram__link" d="M 76 60 C 110 60, 110 100, 144 100" />

          <rect className="pu-diagram__node pu-diagram__node--outcome" x="144" y="4" width="112" height="32" rx="6" />
          <text className="pu-diagram__node-text" x="200" y="24" textAnchor="middle">Push Back</text>
          <rect className="pu-diagram__node pu-diagram__node--outcome" x="144" y="44" width="112" height="32" rx="6" />
          <text className="pu-diagram__node-text" x="200" y="64" textAnchor="middle">Push Back + Down</text>
          <rect className="pu-diagram__node pu-diagram__node--outcome" x="144" y="84" width="112" height="32" rx="6" />
          <text className="pu-diagram__node-text" x="200" y="104" textAnchor="middle">Both Down, Blocked</text>

          <path className="pu-diagram__link" d="M 256 20 C 290 20, 290 46, 324 46" />
          <path className="pu-diagram__link" d="M 256 60 L 324 60" />
          <rect className="pu-diagram__node pu-diagram__node--merged" x="324" y="40" width="128" height="40" rx="6" />
          <text className="pu-diagram__node-text" x="388" y="58" textAnchor="middle">SAME PLAN</text>
          <text className="pu-diagram__node-subtext" x="388" y="72" textAnchor="middle">(lockstep)</text>

          <path className="pu-diagram__link pu-diagram__link--attention" d="M 256 100 L 324 100" />
          <rect className="pu-diagram__node pu-diagram__node--attention" x="324" y="84" width="128" height="40" rx="6" />
          <text className="pu-diagram__node-text" x="388" y="102" textAnchor="middle">NEEDS A PLAN</text>
          <text className="pu-diagram__node-subtext" x="388" y="116" textAnchor="middle">(waits for you)</text>

          <path className="pu-diagram__link pu-diagram__link--attention" d="M 452 92 C 486 92, 486 60, 520 60" />
          <path className="pu-diagram__link pu-diagram__link--attention" d="M 452 104 C 486 104, 486 140, 520 140" />
          <rect className="pu-diagram__node pu-diagram__node--outcome" x="520" y="40" width="104" height="32" rx="6" />
          <text className="pu-diagram__node-text" x="572" y="60" textAnchor="middle">2nd Block…</text>
          <rect className="pu-diagram__node pu-diagram__node--outcome" x="520" y="124" width="104" height="32" rx="6" />
          <text className="pu-diagram__node-text" x="572" y="144" textAnchor="middle">…and again</text>

          <text className="pu-diagram__caption" x="0" y="196">
            ② Outcomes with the same next move rejoin under Lockstep
          </text>
          <text className="pu-diagram__caption" x="0" y="216">
            ③ A different outcome keeps its own plan — and splits again on the next Block
          </text>
        </g>
      </svg>
      <figcaption>{ALT_TEXT}</figcaption>
    </figure>
  );
}
