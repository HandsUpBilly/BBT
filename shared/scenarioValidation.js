// Single source of truth for scenario/series shape rules.
//
// Imported by all three consumers so they can never drift:
//   - client/src/editor/editorValidation.ts  (live editor feedback)
//   - server/editor.js                        (local dev file writes)
//   - netlify/functions/editor-scenarios.js   (production Blobs drafts)
//
// Plain ESM with a sibling .d.ts so the TypeScript client can import it
// directly. Keep it dependency-free — the Netlify bundler, Node, and Vite all
// pull this file in as-is.

export const SCENARIO_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Pitch bounds in portrait coordinates (the orientation scenario JSON uses). */
export const PITCH = { maxCol: 14, maxRow: 25 };

/** Inclusive range every player stat must fall inside. */
export const STAT_RANGE = { min: 1, max: 12 };

export const STAT_KEYS = ['ma', 'st', 'ag', 'pa', 'av'];

export const TEAMS = ['human', 'orc'];
export const OBJECTIVES = ['touchdown'];

/** BB2025 team-sheet caps. A puzzle is a single on-pitch state, so each team
 * may field at most 11 even though its full roster may contain 16 players. */
export const ROSTER_LIMITS = {
  human: {
    lineman: { max: 16, label: 'Human Linemen' },
    halfling: { max: 3, label: 'Halfling Hopefuls' },
    catcher: { max: 2, label: 'Human Catchers' },
    thrower: { max: 2, label: 'Human Throwers' },
    blitzer: { max: 2, label: 'Human Blitzers' },
    ogre: { max: 1, label: 'Ogre' },
  },
  orc: {
    lineman: { max: 16, label: 'Orc Linemen' },
    goblin: { max: 4, label: 'Goblin Linemen' },
    thrower: { max: 2, label: 'Orc Throwers' },
    blitzer: { max: 2, label: 'Orc Blitzers' },
    'big-un': { max: 2, label: 'Big Un Blockers' },
    troll: { max: 1, label: 'Troll' },
  },
};

// Old test fixtures and pre-roster editor drafts used portrait/archetype names
// as roles. Count those conservatively as their closest real roster position.
const ROSTER_ROLE_ALIASES = {
  human: { blocker: 'lineman', guard: 'lineman', tackle: 'lineman' },
  orc: { blocker: 'big-un', 'black-orc': 'big-un' },
};

function canonicalRosterRole(team, role) {
  if (ROSTER_LIMITS[team]?.[role]) return role;
  return ROSTER_ROLE_ALIASES[team]?.[role];
}

export function rosterLimitFor(team, role) {
  const canonical = canonicalRosterRole(team, role);
  return canonical ? ROSTER_LIMITS[team][canonical] : undefined;
}

export function scenarioRosterErrors(scenario) {
  const errors = [];
  for (const team of TEAMS) {
    const teamName = team === 'human' ? 'Human' : 'Orc';
    const pieces = (scenario?.pieces ?? []).filter(piece => piece.team === team);
    if (pieces.length > 11) {
      errors.push(`${teamName} team may field at most 11 players (currently ${pieces.length})`);
    }
    const counts = new Map();
    for (const piece of pieces) {
      const canonical = canonicalRosterRole(team, piece.role);
      if (!canonical) {
        errors.push(`${teamName} roster does not allow role: ${piece.role || '(missing)'}`);
        continue;
      }
      counts.set(canonical, (counts.get(canonical) ?? 0) + 1);
    }
    for (const [role, count] of counts) {
      const rule = ROSTER_LIMITS[team][role];
      if (count > rule.max) {
        errors.push(`${teamName} roster allows at most ${rule.max} ${rule.label} (currently ${count})`);
      }
    }
  }
  return [...new Set(errors)];
}

export function normalizeScenario(input) {
  const source = input && typeof input === 'object' ? input : {};
  const activeTeam = source.activeTeam === 'orc' ? 'orc' : 'human';
  const configuredTeams = Array.isArray(source.teams)
    ? [...new Set(source.teams.filter(team => TEAMS.includes(team)))]
    : [];
  const firstTeam = configuredTeams[0] ?? activeTeam;
  const secondTeam = configuredTeams.find(team => team !== firstTeam)
    ?? TEAMS.find(team => team !== firstTeam)
    ?? firstTeam;
  return {
    id: String(source.id ?? '').trim(),
    name: String(source.name ?? '').trim(),
    description: String(source.description ?? '').trim(),
    activeTeam,
    teams: [firstTeam, secondTeam],
    objective: OBJECTIVES.includes(source.objective) ? source.objective : 'touchdown',
    // Before this field existed, scenario-006 was the sole hard-coded Free
    // Play puzzle. Preserve that published Blob data during migration.
    freePlay: source.freePlay === true || (source.freePlay == null && source.id === 'scenario-006'),
    published: source.published !== false,
    ...(source.adminEnabled === true ? { adminEnabled: true } : {}),
    ballPosition: normalizeBallPosition(source.ballPosition),
    pieces: Array.isArray(source.pieces) ? source.pieces.map(normalizePiece) : [],
  };
}

function normalizeBallPosition(ballPosition) {
  if (!ballPosition || typeof ballPosition !== 'object') return null;
  return { col: Number(ballPosition.col), row: Number(ballPosition.row) };
}

function normalizePiece(piece) {
  const source = piece && typeof piece === 'object' ? piece : {};
  return {
    id: String(source.id ?? '').trim(),
    team: source.team === 'orc' ? 'orc' : 'human',
    role: String(source.role ?? 'lineman').trim(),
    name: String(source.name ?? '').trim(),
    ma: Number(source.ma),
    st: Number(source.st),
    ag: Number(source.ag),
    pa: Number(source.pa),
    av: Number(source.av),
    skills: Array.isArray(source.skills)
      ? source.skills.map(String).map(skill => skill.trim()).filter(Boolean)
      : [],
    position: {
      col: Number(source.position?.col),
      row: Number(source.position?.row),
    },
    hasBall: Boolean(source.hasBall),
    ...(source.down === true ? { down: true } : {}),
  };
}

export function normalizeSeries(input) {
  const source = input && typeof input === 'object' ? input : {};
  const label = typeof source.label === 'string' ? source.label.trim().slice(0, 40) : '';
  const rawLogo = typeof source.logo === 'string' ? source.logo.trim() : '';
  const logo = rawLogo.startsWith('data:')
    ? rawLogo.length <= 200_000 && /^data:image\/webp;base64,[a-z0-9+/]+=*$/i.test(rawLogo) ? rawLogo : ''
    : /^[a-z0-9-]{1,80}$/.test(rawLogo) ? rawLogo : '';
  const id = String(source.id ?? 'default').trim().toLowerCase();
  const teams = Array.isArray(source.teams) ? source.teams.filter(team => TEAMS.includes(team)) : [];
  const scenarioIds = Array.isArray(source.scenarioIds)
    ? [...new Set(source.scenarioIds.map(String).filter(Boolean))]
    : [];
  return {
    id: SCENARIO_ID_RE.test(id) ? id : 'default',
    name: String(source.name ?? 'Default Series').trim() || 'Default Series',
    description: String(source.description ?? '').trim(),
    scenarioIds,
    ...(label ? { label } : {}),
    published: source.published !== false,
    ...(source.adminEnabled === true ? { adminEnabled: true } : {}),
    teams: [teams[0] ?? 'human', teams[1] ?? (teams[0] === 'orc' ? 'human' : 'orc')],
    objective: OBJECTIVES.includes(source.objective) ? source.objective : 'touchdown',
    order: Number.isInteger(source.order) && source.order >= 0 ? source.order : 0,
    ...(logo ? { logo } : {}),
  };
}

/**
 * Series membership is exclusive: one puzzle belongs to at most one series.
 * Enabled empty series are rejected because they render a player-facing card
 * that cannot start a run.
 */
export function seriesMembershipErrors(series, collection = [], scenarios = []) {
  const errors = [];
  if ((series.published !== false || series.adminEnabled === true) && series.scenarioIds.length === 0) {
    errors.push('An enabled series must contain at least one puzzle');
  }
  for (const scenarioId of series.scenarioIds) {
    const owner = collection.find(item => item.id !== series.id && item.scenarioIds.includes(scenarioId));
    if (owner) errors.push(`${scenarioId} is already assigned to ${owner.name}`);
    const scenario = scenarios.find(item => item.id === scenarioId);
    if (scenario) {
      errors.push(...scenarioRosterErrors(scenario).map(error => `${scenario.name || scenario.id}: ${error}`));
    }
  }
  return errors;
}

/** Compatibility mutation for older editor clients. New clients edit series
 * membership through Series Creator, but this keeps the legacy endpoint safe:
 * selecting the current owner is a no-op and assigning across series is never
 * an implicit move. */
export function updateSeriesAssignment(collection, scenarioId, targetSeriesId, scenarios = []) {
  const currentOwner = collection.find(item => item.scenarioIds.includes(scenarioId));
  if (currentOwner?.id === targetSeriesId) return { series: collection, errors: [] };
  if (currentOwner && targetSeriesId) {
    return { series: collection, errors: [`${scenarioId} is already assigned to ${currentOwner.name}`] };
  }

  const series = collection.map(item => {
    const without = item.scenarioIds.filter(id => id !== scenarioId);
    return item.id === targetSeriesId ? { ...item, scenarioIds: [...without, scenarioId] } : { ...item, scenarioIds: without };
  });
  const errors = [...new Set(series.flatMap(item => seriesMembershipErrors(item, series, scenarios)))];
  return errors.length ? { series: collection, errors } : { series, errors: [] };
}

/** Accepts both the legacy single-series object and the new ordered collection. */
export function normalizeSeriesCollection(input) {
  const collection = Array.isArray(input) ? input : input ? [input] : [];
  const seen = new Set();
  return collection
    .map(normalizeSeries)
    .filter(series => {
      if (seen.has(series.id)) return false;
      seen.add(series.id);
      return true;
    })
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
}

function validatePosition(position, label, errors) {
  if (!Number.isInteger(position?.col) || position.col < 0 || position.col > PITCH.maxCol) {
    errors.push(`${label} column must be between 0 and ${PITCH.maxCol}`);
  }
  if (!Number.isInteger(position?.row) || position.row < 0 || position.row > PITCH.maxRow) {
    errors.push(`${label} row must be between 0 and ${PITCH.maxRow}`);
  }
}

/**
 * Validates a *normalized* scenario. Always run normalizeScenario() first —
 * this assumes pieces[].position exists and stats are already Number()-coerced.
 *
 * @param scenario     normalized scenario
 * @param existingIds  ids already taken (Set or array)
 * @param options.allowExisting  skip the "id already exists" check (updates)
 * @param options.currentId      id being edited, exempted from the uniqueness check
 * @returns deduplicated error strings; empty means valid
 */
export function validateScenario(scenario, existingIds = new Set(), options = {}) {
  const { allowExisting = false, currentId } = options;
  const taken = existingIds instanceof Set ? existingIds : new Set(existingIds ?? []);
  const errors = [];

  if (!SCENARIO_ID_RE.test(scenario.id)) {
    errors.push('Scenario id must be lowercase letters, numbers, and hyphens');
  }
  if (!scenario.name) errors.push('Scenario name is required');
  if (!scenario.description) errors.push('Scenario description is required');
  if (!TEAMS.includes(scenario.activeTeam)) errors.push('Active team must be human or orc');
  const involvedTeams = Array.isArray(scenario.teams)
    ? [...new Set(scenario.teams.filter(team => TEAMS.includes(team)))]
    : [...TEAMS];
  if (involvedTeams.length !== 2) errors.push('Choose two different teams for the puzzle');
  if (!involvedTeams.includes(scenario.activeTeam)) errors.push('Active team must be one of the two selected teams');
  if (!allowExisting && scenario.id !== currentId && taken.has(scenario.id)) {
    errors.push('Scenario id already exists');
  }
  if (!Array.isArray(scenario.pieces) || scenario.pieces.length === 0) {
    errors.push('At least one player is required');
  }

  const ids = new Set();
  const squares = new Set();
  let activeTeamPieces = 0;
  let carriers = 0;

  for (const piece of scenario.pieces ?? []) {
    if (!piece.id) errors.push('Every player needs an id');
    if (ids.has(piece.id)) errors.push(`Duplicate player id: ${piece.id}`);
    ids.add(piece.id);
    if (!piece.name) errors.push(`Player ${piece.id || '(missing id)'} needs a name`);
    if (!TEAMS.includes(piece.team)) errors.push(`Player ${piece.id} team must be human or orc`);
    if (!involvedTeams.includes(piece.team)) errors.push(`Player ${piece.id} must belong to one of the two selected teams`);
    if (piece.team === scenario.activeTeam) activeTeamPieces += 1;

    validatePosition(piece.position, `Player ${piece.id}`, errors);
    const square = `${piece.position?.col},${piece.position?.row}`;
    if (squares.has(square)) errors.push(`Multiple players on square ${square}`);
    squares.add(square);

    for (const stat of STAT_KEYS) {
      if (!Number.isInteger(piece[stat]) || piece[stat] < STAT_RANGE.min || piece[stat] > STAT_RANGE.max) {
        errors.push(`Player ${piece.id} ${stat.toUpperCase()} must be between ${STAT_RANGE.min} and ${STAT_RANGE.max}`);
      }
    }

    if (piece.hasBall) carriers += 1;
  }

  if (activeTeamPieces === 0) errors.push('At least one player must belong to the active team');
  if (scenario.ballPosition) validatePosition(scenario.ballPosition, 'Loose ball', errors);
  if (carriers > 1) errors.push('Only one player can carry the ball');
  if (carriers === 1 && scenario.ballPosition) errors.push('Ball can be carried or loose, not both');
  if (carriers === 0 && !scenario.ballPosition) errors.push('Place the ball on a player or on the ground');

  errors.push(...scenarioRosterErrors(scenario));

  return [...new Set(errors)];
}

/** Series ids that no longer resolve to a scenario — surfaced as an editor warning. */
export function missingSeriesScenarioIds(series, scenarios) {
  const known = new Set((scenarios ?? []).map(scenario => scenario.id));
  return (series?.scenarioIds ?? []).filter(id => !known.has(id));
}
