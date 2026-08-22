import type { GameState, Position } from './types';
import type { TutorialAction } from './tutorialLessons';

export type TutorialHintTier = 0 | 1 | 2;

export type TutorialGuideMilestone =
  | { kind: 'piece-selected'; pieceId: string }
  | { kind: 'action-started'; action: TutorialAction; pieceId: string }
  | { kind: 'targeting'; action: 'handoff' | 'pass' | 'block' }
  | { kind: 'action-logged'; action: 'handoff' | 'pass'; pieceName?: string }
  | { kind: 'block-logged'; pieceName?: string }
  | { kind: 'pickup-logged' }
  | { kind: 'movement-logged'; pieceName: string }
  | { kind: 'touchdown' }
  | { kind: 'all-universes-complete' };

export type TutorialExpectedInteraction =
  | { kind: 'piece-selected'; pieceId: string }
  | { kind: 'action-selected'; action: TutorialAction; pieceId: string }
  | { kind: 'target-selected'; action: 'handoff' | 'pass' | 'block'; pieceId: string };

export interface TutorialGuideFocus {
  kind: 'pitch' | 'action' | 'confirmation' | 'probability' | 'universes';
  pieceIds?: readonly string[];
  target?: Position;
  action?: TutorialAction;
  region?: 'end-zone' | 'tackle-zones' | 'receiver' | 'route';
}

export interface TutorialHint {
  text: string;
  alt: string;
  focus: TutorialGuideFocus;
}

export interface TutorialGuideStage {
  id: string;
  title: string;
  hints: readonly [TutorialHint, TutorialHint, TutorialHint];
  milestone: TutorialGuideMilestone;
  expected?: TutorialExpectedInteraction;
  recovery: string;
}

export interface TutorialGuideDefinition {
  scenarioId: string;
  stages: readonly TutorialGuideStage[];
}

const hint = (text: string, alt: string, focus: TutorialGuideFocus): TutorialHint => ({ text, alt, focus });

export const TUTORIAL_GUIDES: readonly TutorialGuideDefinition[] = [
  {
    scenarioId: 'scenario-001',
    stages: [
      {
        id: 'movement-select-carrier', title: 'Start with the ball carrier',
        hints: [
          hint('Find the player carrying the ball. Select a player to see the actions available to them.', 'The opening formation with the ball carrier marked.', { kind: 'pitch', region: 'route' }),
          hint('Aldric Swiftfoot already has the ball. Select him.', 'Aldric Swiftfoot highlighted as the ball carrier.', { kind: 'pitch', pieceIds: ['carrier'] }),
          hint('Select Aldric Swiftfoot on square 6H.', 'The carrier on 6H highlighted for selection.', { kind: 'pitch', pieceIds: ['carrier'], target: { col: 7, row: 6 } }),
        ],
        milestone: { kind: 'piece-selected', pieceId: 'carrier' },
        expected: { kind: 'piece-selected', pieceId: 'carrier' },
        recovery: 'Deselect the other player, then select the ball carrier.',
      },
      {
        id: 'movement-choose-move', title: 'Choose the action',
        hints: [
          hint('Open the action that lets the carrier travel across connected squares.', 'The player action menu beside the selected carrier.', { kind: 'action', pieceIds: ['carrier'] }),
          hint('Choose Move for Aldric.', 'The Move action highlighted in Aldric’s action menu.', { kind: 'action', pieceIds: ['carrier'], action: 'move' }),
          hint('Tap Move. Reachable pitch squares will light up.', 'The Move button and the reachable-square preview.', { kind: 'action', pieceIds: ['carrier'], action: 'move' }),
        ],
        milestone: { kind: 'action-started', action: 'move', pieceId: 'carrier' },
        expected: { kind: 'action-selected', action: 'move', pieceId: 'carrier' },
        recovery: 'Cancel the current selection and choose Move with Aldric.',
      },
      {
        id: 'movement-plot-route', title: 'Plot the route',
        hints: [
          hint('Choose connected highlighted squares toward the objective. The dashed line previews the route before it is final.', 'Reachable squares and a sample dashed movement preview toward the End Zone.', { kind: 'pitch', pieceIds: ['carrier'], region: 'route' }),
          hint('Look for a route around the two Orcs and compare any roll markers before committing.', 'Aldric’s route area with the two blocking Orcs and risk markers.', { kind: 'pitch', pieceIds: ['carrier', 'opp1', 'opp2'], region: 'tackle-zones' }),
          hint('Plot Aldric toward row 0, keeping clear of the Orcs where possible, then finish the route at its tip.', 'A route from Aldric toward the Human End Zone around the defenders.', { kind: 'pitch', pieceIds: ['carrier', 'opp1', 'opp2'], region: 'end-zone' }),
        ],
        milestone: { kind: 'movement-logged', pieceName: 'Aldric Swiftfoot' },
        recovery: 'Use Reset move while the route is still provisional, or Restart if the action was committed.',
      },
      {
        id: 'movement-score', title: 'Finish the objective',
        hints: [
          hint('Continue the carrier’s route until the ball reaches the Human End Zone.', 'The ball carrier and the Human End Zone.', { kind: 'pitch', pieceIds: ['carrier'], region: 'end-zone' }),
          hint('The Human End Zone is row 0. Keep Aldric moving toward it.', 'Row 0 highlighted beyond Aldric’s route.', { kind: 'pitch', pieceIds: ['carrier'], region: 'end-zone' }),
          hint('Select a row 0 scoring square, finish the route, then use the green confirmation control.', 'A scoring square on row 0 and the green Confirm Move control.', { kind: 'confirmation', pieceIds: ['carrier'], target: { col: 7, row: 0 } }),
        ],
        milestone: { kind: 'touchdown' },
        recovery: 'If Aldric can no longer reach the End Zone, Restart Puzzle and try a shorter route.',
      },
    ],
  },
  {
    scenarioId: 'scenario-004',
    stages: [
      {
        id: 'dodge-select-sera', title: 'Read the Tackle Zones',
        hints: [
          hint('Standing opponents mark adjacent squares. Find the carrier and inspect the defenders between her and the End Zone.', 'The carrier, defenders, and the adjacent areas they mark.', { kind: 'pitch', region: 'tackle-zones' }),
          hint('Sera Quickhand carries the ball and has the Dodge skill. Select her.', 'Sera highlighted among the Orc defensive line.', { kind: 'pitch', pieceIds: ['carrier'] }),
          hint('Select Sera on square 9H.', 'Sera on 9H highlighted for selection.', { kind: 'pitch', pieceIds: ['carrier'], target: { col: 7, row: 9 } }),
        ],
        milestone: { kind: 'piece-selected', pieceId: 'carrier' }, expected: { kind: 'piece-selected', pieceId: 'carrier' },
        recovery: 'Deselect the other player and select Sera.',
      },
      {
        id: 'dodge-start-move', title: 'Preview a Dodge route',
        hints: [
          hint('Choose the movement action, then preview routes before committing any square.', 'The selected carrier’s action menu and nearby pitch.', { kind: 'action', pieceIds: ['carrier'] }),
          hint('Choose Move with Sera and watch for Dodge roll markers on the route.', 'Move highlighted with Dodge markers on nearby routes.', { kind: 'action', pieceIds: ['carrier'], action: 'move' }),
          hint('Tap Move, then preview paths toward row 0 without confirming yet.', 'Sera’s Move control and paths toward the End Zone.', { kind: 'action', pieceIds: ['carrier'], action: 'move' }),
        ],
        milestone: { kind: 'action-started', action: 'move', pieceId: 'carrier' }, expected: { kind: 'action-selected', action: 'move', pieceId: 'carrier' },
        recovery: 'Cancel the selection and choose Move with Sera.',
      },
      {
        id: 'dodge-commit-route', title: 'Compare the risk',
        hints: [
          hint('Compare the roll markers and Success Chance before choosing a route.', 'Two possible route shapes with different risk markers.', { kind: 'probability', pieceIds: ['carrier'], region: 'tackle-zones' }),
          hint('Fewer opposing Tackle Zones usually means a stronger route. Sera’s Dodge skill can reroll one failed Dodge.', 'Sera, the nearest defenders, and the Success Chance readout.', { kind: 'probability', pieceIds: ['carrier', 'orc1', 'orc2', 'orc3'], region: 'tackle-zones' }),
          hint('Choose the route with the highest displayed chance, finish it at the route tip, and confirm with green.', 'The safest previewed route and green confirmation control.', { kind: 'confirmation', pieceIds: ['carrier'], region: 'route' }),
        ],
        milestone: { kind: 'movement-logged', pieceName: 'Sera Quickhand' },
        recovery: 'Use Reset move before confirmation, or Restart Puzzle after a committed route.',
      },
      {
        id: 'dodge-score', title: 'Carry the ball home',
        hints: [
          hint('Continue toward the Human End Zone while protecting the probability you have built.', 'Sera and the remaining path to the Human End Zone.', { kind: 'pitch', pieceIds: ['carrier'], region: 'end-zone' }),
          hint('Sera scores by reaching row 0 with the ball.', 'Sera with row 0 highlighted.', { kind: 'pitch', pieceIds: ['carrier'], region: 'end-zone' }),
          hint('Finish a route on row 0 and confirm it.', 'A scoring square and the Confirm Move control.', { kind: 'confirmation', pieceIds: ['carrier'], target: { col: 7, row: 0 } }),
        ], milestone: { kind: 'touchdown' },
        recovery: 'Restart Puzzle if the End Zone is no longer reachable.',
      },
    ],
  },
  {
    scenarioId: 'scenario-002',
    stages: [
      {
        id: 'handoff-select-carrier', title: 'Start the Hand-off',
        hints: [
          hint('Find the ball carrier. The Hand-off action belongs to the player giving away the ball.', 'The carrier and intended receiver on the pitch.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'] }),
          hint('Aldric carries the ball. Select him before Sera.', 'Aldric highlighted as carrier and Sera as receiver.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'] }),
          hint('Select Aldric Swiftfoot on 14H.', 'Aldric on 14H highlighted.', { kind: 'pitch', pieceIds: ['thrower'], target: { col: 7, row: 14 } }),
        ], milestone: { kind: 'piece-selected', pieceId: 'thrower' }, expected: { kind: 'piece-selected', pieceId: 'thrower' },
        recovery: 'Deselect the other player and select Aldric.',
      },
      {
        id: 'handoff-choose-action', title: 'Declare the Hand-off',
        hints: [
          hint('Choose the action that transfers the ball to an adjacent teammate after movement.', 'Aldric’s action menu beside the carrier.', { kind: 'action', pieceIds: ['thrower'] }),
          hint('Choose Hand-off and keep Move first enabled so Aldric can reach Sera.', 'Hand-off and Move first highlighted in the action menu.', { kind: 'action', pieceIds: ['thrower'], action: 'handoff' }),
          hint('Tap Hand-off with Move first enabled.', 'The Hand-off action ready to select.', { kind: 'action', pieceIds: ['thrower'], action: 'handoff' }),
        ], milestone: { kind: 'action-started', action: 'handoff', pieceId: 'thrower' }, expected: { kind: 'action-selected', action: 'handoff', pieceId: 'thrower' },
        recovery: 'Cancel the current activation and declare Hand-off with Aldric.',
      },
      {
        id: 'handoff-target', title: 'Bring the players together',
        hints: [
          hint('Move the carrier next to the intended receiver, finish the route, then choose the highlighted teammate.', 'Aldric moving into an adjacent square beside Sera.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'], region: 'receiver' }),
          hint('Sera Quickhand is the receiver. End Aldric’s movement adjacent to her.', 'Sera highlighted with adjacent Hand-off squares.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'], region: 'receiver' }),
          hint('After Aldric is adjacent, select Sera and use the green Confirm Hand-off control.', 'The Hand-off line from Aldric to Sera and green confirmation control.', { kind: 'confirmation', pieceIds: ['thrower', 'catcher'] }),
        ], milestone: { kind: 'action-logged', action: 'handoff', pieceName: 'Aldric Swiftfoot' },
        expected: { kind: 'target-selected', action: 'handoff', pieceId: 'catcher' },
        recovery: 'Reset Aldric’s move if it is provisional; otherwise Restart Puzzle and bring him beside Sera.',
      },
      {
        id: 'handoff-score', title: 'The receiver can still move',
        hints: [
          hint('Receiving the ball did not use the receiver’s activation. Select the new carrier and finish the objective.', 'Sera holding the ball and still available to activate.', { kind: 'pitch', pieceIds: ['catcher'], region: 'end-zone' }),
          hint('Select Sera, choose Move, and head for row 0.', 'Sera and her path toward the Human End Zone.', { kind: 'action', pieceIds: ['catcher'], action: 'move' }),
          hint('Move Sera to a row 0 square and confirm the scoring route.', 'Sera’s scoring route and green confirmation control.', { kind: 'confirmation', pieceIds: ['catcher'], target: { col: 7, row: 0 } }),
        ], milestone: { kind: 'touchdown' },
        recovery: 'Restart Puzzle if Sera cannot reach the End Zone.',
      },
    ],
  },
  {
    scenarioId: 'scenario-003',
    stages: [
      {
        id: 'pass-select-thrower', title: 'Set up the Pass',
        hints: [
          hint('Find the ball carrier. The Pass action starts with the thrower, not the receiver.', 'The thrower, receiver, and nearby defenders.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'] }),
          hint('Aldric Swiftfoot is the thrower. Select him.', 'Aldric highlighted with Sera farther upfield.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'] }),
          hint('Select Aldric on 10H.', 'Aldric on 10H highlighted.', { kind: 'pitch', pieceIds: ['thrower'], target: { col: 7, row: 10 } }),
        ], milestone: { kind: 'piece-selected', pieceId: 'thrower' }, expected: { kind: 'piece-selected', pieceId: 'thrower' },
        recovery: 'Deselect the other player and select Aldric.',
      },
      {
        id: 'pass-choose-action', title: 'Declare the Pass',
        hints: [
          hint('Choose the action that lets the carrier move before throwing to a teammate.', 'The thrower’s action menu.', { kind: 'action', pieceIds: ['thrower'] }),
          hint('Choose Pass with Move first enabled so Aldric can escape the Tackle Zones.', 'Pass and Move first highlighted.', { kind: 'action', pieceIds: ['thrower'], action: 'pass' }),
          hint('Tap Pass with Move first enabled.', 'The Pass action ready to select.', { kind: 'action', pieceIds: ['thrower'], action: 'pass' }),
        ], milestone: { kind: 'action-started', action: 'pass', pieceId: 'thrower' }, expected: { kind: 'action-selected', action: 'pass', pieceId: 'thrower' },
        recovery: 'Cancel the activation and declare Pass with Aldric.',
      },
      {
        id: 'pass-complete', title: 'Choose the receiver',
        hints: [
          hint('Move clear of pressure, finish the route, then inspect the highlighted receivers and their Pass/Catch chances.', 'Aldric leaving the marked area and a Pass line upfield.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'], region: 'tackle-zones' }),
          hint('Sera Quickhand is the scoring receiver. Select her after Aldric finishes moving.', 'Sera highlighted as the intended receiver.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'], region: 'receiver' }),
          hint('Select Sera, check the displayed Pass and Catch tests, then use Confirm Pass.', 'The Pass line to Sera and green Confirm Pass control.', { kind: 'confirmation', pieceIds: ['thrower', 'catcher'] }),
        ], milestone: { kind: 'action-logged', action: 'pass', pieceName: 'Aldric Swiftfoot' },
        expected: { kind: 'target-selected', action: 'pass', pieceId: 'catcher' },
        recovery: 'Reset the provisional move or Restart Puzzle if Aldric committed an unusable throwing position.',
      },
      {
        id: 'pass-score', title: 'Activate the receiver',
        hints: [
          hint('Catching the ball did not use the receiver’s activation. Use the new carrier to finish the play.', 'Sera holding the ball and still available.', { kind: 'pitch', pieceIds: ['catcher'], region: 'end-zone' }),
          hint('Select Sera, choose Move, and head to row 0.', 'Sera and the Human End Zone.', { kind: 'action', pieceIds: ['catcher'], action: 'move' }),
          hint('Move Sera onto a row 0 square and confirm.', 'Sera’s scoring route and green confirmation control.', { kind: 'confirmation', pieceIds: ['catcher'], target: { col: 7, row: 0 } }),
        ], milestone: { kind: 'touchdown' },
        recovery: 'Restart Puzzle if the receiver can no longer score.',
      },
    ],
  },
  {
    scenarioId: 'scenario-005',
    stages: [
      {
        id: 'drive-plan', title: 'Plan the activation order',
        hints: [
          hint('This drill combines earlier lessons. Identify who has the ball, who must receive it, and which player must act first.', 'The carrier, receiver, defenders, and End Zone in one planning view.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'], region: 'route' }),
          hint('Aldric must act before Sera because he starts with the ball.', 'Aldric numbered first and Sera second.', { kind: 'pitch', pieceIds: ['thrower', 'catcher'] }),
          hint('Select Aldric Swiftfoot on 11H.', 'Aldric on 11H highlighted as the first activation.', { kind: 'pitch', pieceIds: ['thrower'], target: { col: 7, row: 11 } }),
        ], milestone: { kind: 'piece-selected', pieceId: 'thrower' }, expected: { kind: 'piece-selected', pieceId: 'thrower' },
        recovery: 'Deselect the other player and begin with Aldric.',
      },
      {
        id: 'drive-handoff', title: 'Protect the transfer',
        hints: [
          hint('Choose the action that moves the ball from the carrier to the scoring runner, then compare the route risk.', 'Aldric, Sera, and the transfer area.', { kind: 'action', pieceIds: ['thrower', 'catcher'] }),
          hint('Declare Hand-off with Aldric and Move first toward Sera.', 'Hand-off highlighted with Aldric’s route toward Sera.', { kind: 'action', pieceIds: ['thrower', 'catcher'], action: 'handoff' }),
          hint('Choose Hand-off, move Aldric adjacent to Sera, select Sera, and confirm the transfer.', 'Aldric beside Sera with the green Confirm Hand-off control.', { kind: 'confirmation', pieceIds: ['thrower', 'catcher'] }),
        ], milestone: { kind: 'action-logged', action: 'handoff', pieceName: 'Aldric Swiftfoot' }, expected: { kind: 'action-selected', action: 'handoff', pieceId: 'thrower' },
        recovery: 'Reset the provisional move, or Restart Puzzle if the transfer can no longer be completed.',
      },
      {
        id: 'drive-score', title: 'Finish with the runner',
        hints: [
          hint('The receiver remains available. Compare the remaining routes and protect the cumulative chance.', 'Sera with the remaining defenders and Success Chance.', { kind: 'probability', pieceIds: ['catcher'], region: 'tackle-zones' }),
          hint('Activate Sera and choose Move toward the Human End Zone.', 'Sera highlighted with routes toward row 0.', { kind: 'action', pieceIds: ['catcher'], action: 'move' }),
          hint('Choose the highest-chance route that reaches row 0, finish it, and confirm.', 'Sera’s scoring route, Success Chance, and green confirmation control.', { kind: 'confirmation', pieceIds: ['catcher'], target: { col: 7, row: 0 } }),
        ], milestone: { kind: 'touchdown' },
        recovery: 'Restart Puzzle if the remaining movement cannot complete the drive.',
      },
    ],
  },
  {
    scenarioId: 'scenario-006',
    stages: [
      {
        id: 'universes-select-blocker', title: 'Open a path to the ball',
        hints: [
          hint('The loose ball is marked by an Orc. Find a Human who can move that defender without spending the future ball carrier’s activation.', 'The loose ball, nearby Humans, and the marking Orc.', { kind: 'pitch', region: 'tackle-zones' }),
          hint('Cedric Linebreaker is already beside Muzgash and has Block. Select Cedric.', 'Cedric highlighted beside Muzgash and the loose ball.', { kind: 'pitch', pieceIds: ['cedric', 'muzgash'] }),
          hint('Select Cedric Linebreaker on 7G.', 'Cedric on 7G highlighted for selection.', { kind: 'pitch', pieceIds: ['cedric'], target: { col: 6, row: 7 } }),
        ],
        milestone: { kind: 'piece-selected', pieceId: 'cedric' },
        expected: { kind: 'piece-selected', pieceId: 'cedric' },
        recovery: 'Cancel the other activation, then select Cedric beside Muzgash.',
      },
      {
        id: 'universes-declare-block', title: 'Declare the Block',
        hints: [
          hint('Choose the action that rolls Block dice without moving Cedric first.', 'Cedric’s action menu with the contact action available.', { kind: 'action', pieceIds: ['cedric'] }),
          hint('Choose Block, not Blitz. Cedric is already adjacent to the target.', 'The Block action highlighted for Cedric.', { kind: 'action', pieceIds: ['cedric'], action: 'block' }),
          hint('Select Block and confirm the action.', 'Cedric’s Block control ready to confirm.', { kind: 'action', pieceIds: ['cedric'], action: 'block' }),
        ],
        milestone: { kind: 'action-started', action: 'block', pieceId: 'cedric' },
        expected: { kind: 'action-selected', action: 'block', pieceId: 'cedric' },
        recovery: 'Cancel the current selection and declare a Block with Cedric.',
      },
      {
        id: 'universes-create-branches', title: 'Create the universes',
        hints: [
          hint('Choose the adjacent Orc whose position is blocking access to the ball, then review which dice outcomes can continue.', 'Cedric, the loose ball, and adjacent Block targets.', { kind: 'pitch', pieceIds: ['cedric'], region: 'tackle-zones' }),
          hint('Muzgash Skullkrak is between Cedric and the ball. Select him as the Block target.', 'Muzgash highlighted as Cedric’s Block target.', { kind: 'pitch', pieceIds: ['cedric', 'muzgash'] }),
          hint('Select Muzgash on 6G. Accept the viable Block outcomes to create Parallel Universes, then resolve any push squares.', 'Cedric blocking Muzgash beside the loose ball before the board splits.', { kind: 'confirmation', pieceIds: ['cedric', 'muzgash'], target: { col: 6, row: 6 } }),
        ],
        milestone: { kind: 'block-logged', pieceName: 'Cedric Linebreaker' },
        expected: { kind: 'target-selected', action: 'block', pieceId: 'muzgash' },
        recovery: 'Return to Cedric’s Block target selection, or Restart Puzzle if the Block was cancelled.',
      },
      {
        id: 'universes-recover-ball', title: 'Work through every universe',
        hints: [
          hint('The branch strip now represents different valid board states. Visit each live universe and find a safe way to recover the loose ball.', 'A root play split into numbered universe cards, with the loose ball still to recover.', { kind: 'universes', region: 'route' }),
          hint('Use the numbered branch cards to switch universes. Safe actions may replay in lockstep; once boards differ, solve the selected branch from its actual positions.', 'Numbered universe cards connected to the same root action, with one selected.', { kind: 'universes', pieceIds: ['aldric'], region: 'route' }),
          hint('In each live universe, move a viable Human onto the ball at 5H. Aldric’s Sure Hands can protect the Pickup roll, but use the positions actually shown in that branch.', 'The universe strip and a route toward the loose ball on 5H.', { kind: 'universes', pieceIds: ['aldric'], target: { col: 7, row: 5 } }),
        ],
        milestone: { kind: 'pickup-logged' },
        recovery: 'Switch to an unfinished universe, Reset branch if its line went wrong, or restart the drill to choose different Block outcomes.',
      },
      {
        id: 'universes-finish-all', title: 'Complete every live branch',
        hints: [
          hint('Carry the recovered ball into the Human End Zone in every live universe. The run finishes only when every branch has scored or been conceded.', 'Numbered universes progressing independently toward the Human End Zone.', { kind: 'universes', region: 'end-zone' }),
          hint('Use the branch strip to find any universe that is not green, then continue its ball carrier toward row 0.', 'One unfinished universe selected beside completed green universe cards.', { kind: 'universes', region: 'end-zone' }),
          hint('Finish each remaining route on row 0 and confirm it. Green parent branches mean all of their children are complete.', 'All numbered universe cards green after their scoring routes reach row 0.', { kind: 'universes', target: { col: 7, row: 0 } }),
        ],
        milestone: { kind: 'all-universes-complete' },
        recovery: 'Select an unfinished branch in the strip; Reset branch or give it up only after reviewing that branch’s current board.',
      },
    ],
  },
] as const;

const GUIDE_BY_SCENARIO = new Map(TUTORIAL_GUIDES.map(guide => [guide.scenarioId, guide]));

export function tutorialGuideFor(scenarioId: string): TutorialGuideDefinition | undefined {
  return GUIDE_BY_SCENARIO.get(scenarioId);
}

export interface TutorialGuideObservation {
  allUniversesComplete?: boolean;
}

export function milestoneReached(
  milestone: TutorialGuideMilestone,
  state: GameState,
  observation: TutorialGuideObservation = {},
): boolean {
  switch (milestone.kind) {
    case 'piece-selected': return state.selectedPieceId === milestone.pieceId;
    case 'action-started': {
      if (state.selectedPieceId !== milestone.pieceId) return false;
      if (milestone.action === 'move') return state.reachableKeys.size > 0;
      if (milestone.action === 'handoff') return state.pendingHandoff || state.isHandoffTargeting;
      if (milestone.action === 'pass') return state.pendingPass || state.isPassTargeting;
      if (milestone.action === 'block' || milestone.action === 'blitz') return state.pendingBlock || state.isBlockTargeting;
      return false;
    }
    case 'targeting':
      return milestone.action === 'handoff' ? state.isHandoffTargeting
        : milestone.action === 'pass' ? state.isPassTargeting
          : state.isBlockTargeting;
    case 'action-logged': return state.actionLog.some(entry =>
      entry.kind === milestone.action && (!milestone.pieceName || entry.pieceName === milestone.pieceName));
    case 'block-logged': return state.actionLog.some(entry =>
      entry.kind === 'block' && (!milestone.pieceName || entry.pieceName === milestone.pieceName));
    case 'pickup-logged': return state.actionLog.some(entry =>
      entry.kind === 'move' && entry.pickupTarget !== null && entry.pickupTarget !== undefined);
    case 'movement-logged': return state.actionLog.some(entry =>
      entry.kind === 'move' && entry.pieceName === milestone.pieceName);
    case 'touchdown': return state.phase === 'touchdown';
    case 'all-universes-complete': return observation.allUniversesComplete === true;
  }
}
