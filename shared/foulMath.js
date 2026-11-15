/**
 * BB2025 Foul action, resolved as an exact probability tree rather than
 * fabricating a favourable armour/injury roll. All probabilities include
 * natural doubles and referee send-offs. No dice outcomes are sampled.
 *
 * Stored AV is one below the printed armour target (see playerStats.ts).
 * "Injury" for this puzzle means a casualty, not merely stunned or KO'd.
 */
const DICE = Array.from({ length: 36 }, (_, n) => {
  const a = Math.floor(n / 6) + 1;
  const b = n % 6 + 1;
  return { sum: a + b, double: a === b };
});

/**
 * Input is fully serializable and can be recomputed by the leaderboard API.
 * The calling rules engine may choose any eligible offensive assist count.
 */
export function foulOdds({ av, offensiveAssists = 0, defensiveAssists = 0, dirtyPlayer = false, sneakyGit = false, loneFouler = false, stunty = false }) {
  if (!Number.isInteger(av) || av < 1 || av > 12
    || !Number.isInteger(offensiveAssists) || offensiveAssists < 0 || offensiveAssists > 10
    || !Number.isInteger(defensiveAssists) || defensiveAssists < 0 || defensiveAssists > 10) {
    throw new RangeError('Invalid foul armour or assists');
  }
  const armourTarget = av + 1;
  const injuryTarget = stunty ? 9 : 10;
  const modifier = offensiveAssists - defensiveAssists;
  const canReroll = loneFouler && offensiveAssists === 0 && defensiveAssists === 0;
  let breaks = 0;
  let casualties = 0;
  let sentOff = 0;
  let casualtyAndSentOff = 0;

  // Each branch is an entire physical dice outcome. When a failed armour
  // roll has Lone Fouler, re-roll it once. A previous double still counts.
  const resolveArmour = (first, second, weight) => {
    const roll = second ?? first;
    const naturalArmourBreak = roll.sum + modifier >= armourTarget;
    const usedDirtyOnArmour = !naturalArmourBreak
      && dirtyPlayer && roll.sum + modifier + 1 >= armourTarget;
    const broken = naturalArmourBreak || usedDirtyOnArmour;
    const armourDouble = first.double || Boolean(second?.double);
    const sneakyProtects = sneakyGit && !broken;
    const sendOffOnArmour = armourDouble && !sneakyProtects;

    if (!broken) {
      if (sendOffOnArmour) sentOff += weight;
      return;
    }

    breaks += weight;
    for (const injury of DICE) {
      const injuryBonus = dirtyPlayer && !usedDirtyOnArmour ? 1 : 0;
      const casualty = injury.sum + injuryBonus >= injuryTarget;
      const expelled = sendOffOnArmour || injury.double;
      const p = weight / 36;
      if (casualty) casualties += p;
      if (expelled) sentOff += p;
      if (casualty && expelled) casualtyAndSentOff += p;
    }
  };

  for (const first of DICE) {
    const baseBroken = first.sum + modifier >= armourTarget;
    const dirtyCanRescue = dirtyPlayer && first.sum + modifier + 1 >= armourTarget;
    if (canReroll && !baseBroken && !dirtyCanRescue) {
      for (const second of DICE) resolveArmour(first, second, 1 / 1296);
    } else {
      resolveArmour(first, null, 1 / 36);
    }
  }
  return {
    armourBreakProbability: breaks,
    injuryProbability: casualties,
    sentOffProbability: sentOff,
    injuryAndSentOffProbability: casualtyAndSentOff,
    noInjuryProbability: 1 - casualties,
  };
}
