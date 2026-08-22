import { useState } from 'react';
import { OBJECTIVE_GUIDANCE } from './objectiveCopy';
import './HelpScreen.css';

type HelpPage = 'basics' | 'actions' | 'universes';

interface Props {
  onBack: () => void;
}

function DecisionPicture() {
  return (
    <figure className="help-screen__figure">
      <svg className="help-screen__picture" viewBox="0 0 520 250" role="img" aria-label="A plotted movement route ending beside red cancel and green confirm buttons">
        <defs>
          <pattern id="help-grid" width="52" height="50" patternUnits="userSpaceOnUse">
            <rect width="52" height="50" fill="#263d25" />
            <path d="M52 0H0V50" fill="none" stroke="#61705b" strokeWidth="2" opacity=".48" />
          </pattern>
          <marker id="help-route-arrow" viewBox="0 0 8 8" markerWidth="18" markerHeight="18" refX="7" refY="4" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0 0L8 4L0 8Z" fill="#e7e3d9" />
          </marker>
        </defs>
        <rect x="10" y="10" width="500" height="230" rx="12" fill="url(#help-grid)" stroke="#808875" />
        <circle cx="88" cy="185" r="26" fill="#173f66" stroke="#d7c469" strokeWidth="6" />
        <text x="88" y="193" textAnchor="middle" className="help-screen__svg-token">R</text>
        <path d="M114 174C170 160 188 108 247 109S316 64 358 66" fill="none" stroke="#e7e3d9" strokeWidth="8" strokeLinecap="round" strokeDasharray="13 13" markerEnd="url(#help-route-arrow)" />
        <circle cx="378" cy="65" r="11" fill="#d5a13c" stroke="#171a17" strokeWidth="5" />
        <g transform="translate(397 91)">
          <rect width="92" height="48" rx="24" fill="#121512" stroke="#41473f" />
          <circle cx="25" cy="24" r="17" fill="#a94232" />
          <path d="M18 17L32 31M32 17L18 31" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
          <circle cx="67" cy="24" r="17" fill="#568b35" />
          <path d="M59 24L65 30L76 17" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      <figcaption>Tap the red control to rethink the target; tap green to commit it.</figcaption>
    </figure>
  );
}

function ActionPicture() {
  return (
    <figure className="help-screen__figure">
      <svg className="help-screen__picture" viewBox="0 0 520 250" role="img" aria-label="Movement, hand-off, pass, and block actions shown on a small pitch">
        <rect x="10" y="10" width="500" height="230" rx="12" fill="#263d25" stroke="#808875" />
        <g stroke="#65735f" strokeWidth="2" opacity=".55">
          <path d="M10 67H510M10 125H510M10 183H510M110 10V240M210 10V240M310 10V240M410 10V240" />
        </g>
        <g className="help-screen__svg-token" textAnchor="middle">
          <circle cx="68" cy="184" r="24" fill="#173f66" stroke="#d7c469" strokeWidth="5" /><text x="68" y="192">R</text>
          <circle cx="246" cy="125" r="24" fill="#173f66" stroke="#9eb6c7" strokeWidth="5" /><text x="246" y="133">C</text>
          <circle cx="442" cy="52" r="24" fill="#173f66" stroke="#9eb6c7" strokeWidth="5" /><text x="442" y="60">R</text>
          <circle cx="442" cy="184" r="24" fill="#762d25" stroke="#b7553c" strokeWidth="5" /><text x="442" y="192">O</text>
        </g>
        <path d="M91 176C129 164 145 133 179 127" fill="none" stroke="#e7e3d9" strokeWidth="7" strokeDasharray="10 10" strokeLinecap="round" />
        <path d="M273 113Q345 47 414 51" fill="none" stroke="#69a6d8" strokeWidth="6" strokeLinecap="round" />
        <path d="M273 139Q355 190 414 184" fill="none" stroke="#d9854e" strokeWidth="6" strokeLinecap="round" />
        <ellipse cx="328" cy="76" rx="13" ry="8" transform="rotate(-32 328 76)" fill="#a86329" stroke="#e4b070" strokeWidth="3" />
        <circle cx="207" cy="124" r="10" fill="#d5a13c" stroke="#171a17" strokeWidth="4" />
        <text x="55" y="43" className="help-screen__svg-label">MOVE</text>
        <text x="259" y="43" className="help-screen__svg-label">PASS</text>
        <text x="334" y="224" className="help-screen__svg-label">BLOCK</text>
      </svg>
      <figcaption>White plots movement, blue carries the ball, and orange marks contact.</figcaption>
    </figure>
  );
}

function UniverseTreePicture() {
  return (
    <figure className="help-screen__figure help-screen__figure--wide">
      <svg className="help-screen__picture" viewBox="0 0 720 310" role="img" aria-label="A block splitting one root play into universes 1, 2, and 3, with a later block splitting universe 1 into 1.1 and 1.2">
        <g fill="none" stroke="#754234" strokeWidth="5">
          <path d="M154 154H240C285 154 278 62 330 62H395" />
          <path d="M154 154H395" />
          <path d="M154 154H240C285 154 278 246 330 246H395" />
          <path d="M480 62H520C555 62 550 30 586 30H620" />
          <path d="M480 62H520C555 62 550 100 586 100H620" />
        </g>
        <g className="help-screen__tree-node">
          <rect x="25" y="112" width="129" height="84" rx="14" />
          <rect x="395" y="29" width="85" height="66" rx="13" />
          <rect x="395" y="121" width="85" height="66" rx="13" />
          <rect x="395" y="213" width="85" height="66" rx="13" />
          <rect x="620" y="4" width="78" height="52" rx="12" />
          <rect x="620" y="74" width="78" height="52" rx="12" />
        </g>
        <g className="help-screen__svg-label" textAnchor="middle">
          <text x="89" y="145">BLOCK 1</text><text x="89" y="170">ROOT</text>
          <text x="437" y="70">1</text><text x="437" y="162">2</text><text x="437" y="254">3</text>
          <text x="659" y="36">1.1</text><text x="659" y="106">1.2</text>
        </g>
      </svg>
      <figcaption>The first split is 1, 2, 3. A later split inside universe 1 becomes 1.1, 1.2.</figcaption>
    </figure>
  );
}

function BranchStripPicture() {
  return (
    <figure className="help-screen__figure">
      <div className="help-screen__strip-picture" role="img" aria-label="Three universe cards in a branch strip, with universe 1 selected and universe 2 waiting for lockstep actions">
        <div className="help-screen__strip-card help-screen__strip-card--selected"><strong>1</strong><span>Pushed + Down</span><small>Viewed</small></div>
        <div className="help-screen__strip-card"><strong>2</strong><span>Down in place</span><small>Waiting</small></div>
        <div className="help-screen__strip-card"><strong>3</strong><span>Pushed</span><small>Waiting</small></div>
      </div>
      <figcaption>Select a strip to view it. Reset move clears inherited movement. Reset branch returns to the fork after confirmation.</figcaption>
    </figure>
  );
}

function LockstepPicture() {
  return (
    <figure className="help-screen__figure">
      <svg className="help-screen__picture" viewBox="0 0 520 250" role="img" aria-label="The same safe movement copied across three universes until one universe stops before entering a marked square">
        <defs>
          <marker id="lockstep-stop" markerWidth="10" markerHeight="10" refX="5" refY="5">
            <circle cx="5" cy="5" r="4" fill="#d5a13c" />
          </marker>
        </defs>
        <g className="help-screen__svg-label"><text x="22" y="55">1</text><text x="22" y="126">2</text><text x="22" y="197">3</text></g>
        <g fill="none" stroke="#e7e3d9" strokeWidth="7" strokeLinecap="round" strokeDasharray="11 11">
          <path d="M61 49H408" />
          <path d="M61 120H326" markerEnd="url(#lockstep-stop)" />
          <path d="M61 191H408" />
        </g>
        <g className="help-screen__svg-token" textAnchor="middle">
          <circle cx="66" cy="49" r="22" fill="#173f66" stroke="#d7c469" strokeWidth="5" /><text x="66" y="57">R</text>
          <circle cx="66" cy="120" r="22" fill="#173f66" stroke="#d7c469" strokeWidth="5" /><text x="66" y="128">R</text>
          <circle cx="66" cy="191" r="22" fill="#173f66" stroke="#d7c469" strokeWidth="5" /><text x="66" y="199">R</text>
          <circle cx="407" cy="120" r="25" fill="#762d25" stroke="#b7553c" strokeWidth="5" /><text x="407" y="128">O</text>
        </g>
        <rect x="355" y="89" width="104" height="62" rx="9" fill="none" stroke="#d9854e" strokeWidth="4" strokeDasharray="7 5" />
        <text x="259" y="232" className="help-screen__svg-label" textAnchor="middle">COPIED UNTIL THE BOARD CHANGES</text>
      </svg>
      <figcaption>Lockstep copies a shared plan while it stays legal. A branch stops before entering a square that would create a forced dodge next.</figcaption>
    </figure>
  );
}

export function HelpScreen({ onBack }: Props) {
  const [page, setPage] = useState<HelpPage>('basics');

  return (
    <main className="help-screen">
      <header className="help-screen__header">
        <button className="lb-back-btn" onClick={onBack}>← Back</button>
        <div>
          <p className="help-screen__eyebrow">Coach's handbook</p>
          <h1>Help &amp; rules</h1>
          <p>Plan one complete turn and protect its probability.</p>
        </div>
      </header>

      <nav className="help-screen__tabs" aria-label="Help pages" role="tablist">
        {([
          ['basics', 'Getting started'],
          ['actions', 'Actions'],
          ['universes', 'Parallel Universes'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={page === id}
            className={page === id ? 'help-screen__tab help-screen__tab--active' : 'help-screen__tab'}
            onClick={() => setPage(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {page === 'basics' && (
        <article className="help-screen__page" role="tabpanel">
          <div className="help-screen__intro">
            <div>
              <p className="help-screen__kicker">One puzzle. One turn.</p>
              <h2>Find the strongest sequence</h2>
              <p>{OBJECTIVE_GUIDANCE} Activate each player at most once. Every roll you commit multiplies the objective chance shown in the HUD.</p>
            </div>
            <DecisionPicture />
          </div>
          <ol className="help-screen__steps">
            <li><strong>Select a player.</strong><span>Choose Move, Hand-off, Pass, Block, or Blitz from their action menu.</span></li>
            <li><strong>Preview the plan.</strong><span>Highlighted squares are legal. Dashed routes and target lines show what will happen.</span></li>
            <li><strong>Confirm the target.</strong><span>Movement, passes, and hand-offs wait for the green control. Red lets you choose again.</span></li>
            <li><strong>Meet the objective.</strong><span>The puzzle ends when its stated objective is achieved; there is no End Turn button or fresh probability chain.</span></li>
          </ol>
          <aside className="help-screen__callout">
            <strong>The objective can change.</strong>
            <span>Today's puzzles ask for a touchdown. Future puzzles may ask for a successful foul, a crowd surf, or another one-turn outcome.</span>
          </aside>
        </article>
      )}

      {page === 'actions' && (
        <article className="help-screen__page" role="tabpanel">
          <div className="help-screen__intro">
            <div>
              <p className="help-screen__kicker">Read the pitch</p>
              <h2>Actions and rolls</h2>
              <p>The HUD combines every committed roll with the route or target currently being previewed. Lower odds are not a penalty: they are the real cost of that line.</p>
            </div>
            <ActionPicture />
          </div>
          <div className="help-screen__cards">
            <section><span className="help-screen__action-icon">↟</span><h3>Move</h3><p>Plot connected squares up to the player's MA. Extra squares are rushes. Leaving an opponent's tackle zone requires a dodge.</p></section>
            <section><span className="help-screen__action-icon">●→</span><h3>Hand-off</h3><p>Move the carrier next to a teammate, select the receiver, then confirm. The receiver must catch the ball.</p></section>
            <section><span className="help-screen__action-icon">◒</span><h3>Pass</h3><p>Select a legal receiver and confirm. Range affects the throw, then the receiver makes the catch.</p></section>
            <section><span className="help-screen__action-icon">⚔</span><h3>Block &amp; Blitz</h3><p>Blocks split reality by every distinct die result. A Blitz combines movement and one block in the same activation.</p></section>
          </div>
        </article>
      )}

      {page === 'universes' && (
        <article className="help-screen__page" role="tabpanel">
          <div className="help-screen__universe-title">
            <p className="help-screen__kicker">Every block result is played</p>
            <h2>Parallel Universes</h2>
            <p>A block does not choose one die result. It creates a live universe for every distinct outcome, and your score is the combined chance of the universes that still reach the end zone.</p>
          </div>
          <UniverseTreePicture />
          <div className="help-screen__explain-grid">
            <section>
              <h3>Branch strips</h3>
              <BranchStripPicture />
              <p>The first split is numbered <strong>1, 2, 3...</strong>. If universe 1 later splits, its children are <strong>1.1, 1.2...</strong>. The selected strip controls which board you are viewing.</p>
            </section>
            <section>
              <h3>Lockstep</h3>
              <LockstepPicture />
              <p>Actions before a split are shared history. After a split, a safe action is copied to matching universes so you do not repeat identical work. Copying stops where positions, legality, or risk diverge.</p>
            </section>
          </div>
          <aside className="help-screen__callout">
            <strong>Keep every line alive when you can.</strong>
            <span>Reset branch returns one universe to its fork and removes its later children after confirmation. Give up permanently removes that branch's probability.</span>
          </aside>
        </article>
      )}
    </main>
  );
}
