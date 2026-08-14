// The block-branching probability maths, shared by the client engine and the
// server-side score validator.
//
// This lives in shared/ for the usual anti-drift reason, but here it matters
// more than most: the client computes a run's score by walking a tree of board
// states, and the validator has to reach the identical number from the
// submitted tree. Two implementations of this would disagree in the sixth
// decimal place and start rejecting honest scores.
//
// See spec.md, "Block Outcomes as Board-State Branches".

/** Faces on a block die. */
export const DIE_FACES = 6;

/**
 * How likely each live board state is, given what each one is worth.
 *
 * With 2-3 dice the picking side chooses *after* seeing the roll, so this is a
 * decision made under information rather than a chance node. Because only the
 * resulting board matters, the optimal policy is a preference ordering over
 * board states — take the best one available — and the weights then follow in
 * closed form. With the states ranked best-first and `s(k)` the face count of
 * ranks k and worse:
 *
 *   attacker picks -> P(rank k) = (s(k)/6)^N - (s(k+1)/6)^N
 *   defender picks -> P(rank k) = (t(k)/6)^N - (t(k-1)/6)^N   [t = ranks k and better]
 *
 * i.e. "every die landed at rank k or worse, minus every die landed strictly
 * worse". Face counts stay integral until the final division so a whole die's
 * outcomes sum to exactly 1.
 *
 * Ties fall back to the given order so the split between equally good states is
 * deterministic; the node's overall value is the same either way.
 *
 * @param {number[]} faceCounts faces producing each live state
 * @param {number} deadFaceCount faces that end the drive (never a branch)
 * @param {number[]} values conditional chance of scoring from each live state
 * @param {1|2|3} diceCount
 * @param {'attacker'|'defender'} picker
 * @returns {{ probabilities: number[], deadProbability: number, order: number[] }}
 */
export function blockStateWeights(faceCounts, deadFaceCount, values, diceCount, picker) {
  const entries = faceCounts.map((faceCount, index) => ({
    index,
    faceCount,
    value: values[index] ?? 0,
  }));
  if (deadFaceCount > 0) {
    entries.push({ index: faceCounts.length, faceCount: deadFaceCount, value: 0 });
  }

  // Best first; ties keep the caller's order, and the dead outcome sorts last.
  entries.sort((a, b) => b.value - a.value || a.index - b.index);

  const n = entries.length;
  const share = faces => Math.pow(faces / DIE_FACES, diceCount);
  const ranked = new Array(n).fill(0);

  if (picker === 'attacker') {
    let worseOrEqual = 0;
    for (let k = n - 1; k >= 0; k--) {
      const strictlyWorse = worseOrEqual;
      worseOrEqual += entries[k].faceCount;
      ranked[k] = share(worseOrEqual) - share(strictlyWorse);
    }
  } else {
    // Mirror: the defender takes the worst face on the dice.
    let betterOrEqual = 0;
    for (let k = 0; k < n; k++) {
      const strictlyBetter = betterOrEqual;
      betterOrEqual += entries[k].faceCount;
      ranked[k] = share(betterOrEqual) - share(strictlyBetter);
    }
  }

  const probabilities = new Array(faceCounts.length).fill(0);
  let deadProbability = 0;
  const order = [];
  for (let k = 0; k < n; k++) {
    const { index } = entries[k];
    if (index === faceCounts.length) deadProbability = ranked[k];
    else {
      probabilities[index] = ranked[k];
      order.push(index);
    }
  }

  return { probabilities, deadProbability, order };
}

/**
 * The block's contribution to the line: the expected chance of scoring across
 * every board state it can leave behind.
 */
export function blockNodeWeightedValue(faceCounts, deadFaceCount, values, diceCount, picker) {
  const { probabilities } = blockStateWeights(faceCounts, deadFaceCount, values, diceCount, picker);
  return probabilities.reduce((total, p, index) => total + p * (values[index] ?? 0), 0);
}
