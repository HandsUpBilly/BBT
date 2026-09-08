# BB2025 roster audit ledger

Audit date: 2026-09-08  
Reference: [dadidimerda.it BB2025 Teams & Rosters](https://dadidimerda.it/teams.php?ruleset=bb25)

Scope: every roster position currently supported by the puzzle editor and the
shipped scenarios. The game stores AG as `6 - printed target` and AV as
`printed target - 1`; the values below are the printed BB2025 roster values.

| Team | Position | BB2025 roster (MA/ST/AG/PA/AV) | Skills and traits | Data change | Audit result |
| --- | --- | --- | --- | --- | --- |
| Human | Human Lineman | 6/3/3+/4+/9+ | — | None | Matches |
| Human | Halfling Hopeful | 5/2/3+/4+/7+ | Dodge, Right Stuff, Stunty | None | Matches |
| Human | Human Catcher | 8/3/3+/4+/8+ | Catch, Dodge | None | Matches |
| Human | Human Thrower | 6/3/3+/3+/9+ | Pass, Sure Hands | None | Matches |
| Human | Human Blitzer | 7/3/3+/4+/9+ | Block, Tackle | None | Matches |
| Human | Ogre | 5/5/4+/5+/10+ | Bone Head, Loner (3+), Mighty Blow, Thick Skull, Throw Team-Mate | None | Matches |
| Orc | Orc Lineman | 5/3/3+/4+/10+ | — | None | Matches |
| Orc | Goblin Lineman | 6/2/3+/3+/8+ | Dodge, Right Stuff, Stunty | None | Matches |
| Orc | Orc Thrower | 6/3/3+/3+/9+ | Pass, Sure Hands | None | Matches |
| Orc | Orc Blitzer | 6/3/3+/4+/10+ | Block, Break Tackle | None | Matches |
| Orc | Big Un Blocker | 5/4/4+/6+/10+ | Mighty Blow, Taunt, Thick Skull, Unsteady | None | Matches |
| Orc | Troll | 4/5/5+/5+/10+ | Always Hungry, Loner (4+), Mighty Blow, Projectile Vomit, Really Stupid, Regeneration, Throw Team-Mate | None | Matches |
| Black Orc | Goblin Bruiser | 6/2/3+/4+/8+ | Dodge, Right Stuff, Stunty, Thick Skull | None | Matches |
| Black Orc | Black Orc | 4/4/4+/5+/10+ | Brawler, Grab | None | Matches |
| Black Orc | Trained Troll | 4/5/5+/5+/10+ | Always Hungry, Mighty Blow, Projectile Vomit, Really Stupid, Regeneration, Throw Team-Mate | None | Matches |
| Imperial Nobility | Imperial Retainer | 6/3/3+/4+/8+ | Fend | None | Matches |
| Imperial Nobility | Imperial Thrower | 6/3/3+/2+/9+ | Give And Go, Pass, Pro | None | Matches |
| Imperial Nobility | Bodyguard | 5/3/3+/4+/9+ | Stand Firm, Wrestle | None | Matches |
| Imperial Nobility | Noble Blitzer | 7/3/3+/4+/9+ | Block, Catch, Pro | None | Matches |
| Imperial Nobility | Ogre | 5/5/4+/5+/10+ | Bone Head, Loner (3+), Mighty Blow, Thick Skull, Throw Team-Mate | None | Matches |

## Corrections made

All 20 roster templates and every copied player in the six shipped scenarios
already match the reference after accounting for the engine's AG/AV storage
format. The defect was presentation: cards and the editor palette exposed the
normalized internal values. The UI now restores the printed AG and AV targets,
and consistently appends `+` to AG, PA, and AV:

- `ag: 2` displays as `AG 4+`, not `AG 2+`.
- `av: 7` displays as `AV 8+`, not `AV 7+`.
- Existing `PA` values display as targets (for example, `PA 3+`).
