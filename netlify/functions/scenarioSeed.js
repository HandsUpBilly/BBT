// GENERATED FILE — do not edit.
// Produced by scripts/generate-scenario-seed.mjs from:
//   client/src/scenarios/*.json  (6 files)
//   client/src/series/default.json
// Regenerate with: npm run generate:seed

export const STATIC_SCENARIOS = [
  {
    "id": "scenario-001",
    "name": "Reikland's Opening Drive",
    "description": "OBJECTIVE: Carry the ball into the Human End Zone. Two Orc Linemen block the direct route. Choose the safest path.",
    "activeTeam": "human",
    "published": true,
    "pieces": [
      {
        "id": "carrier",
        "team": "human",
        "role": "thrower",
        "name": "Aldric Swiftfoot",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 3,
        "av": 8,
        "skills": [
          "Pass",
          "Sure Hands"
        ],
        "position": {
          "col": 7,
          "row": 6
        },
        "hasBall": true
      },
      {
        "id": "opp1",
        "team": "orc",
        "role": "lineman",
        "name": "Grukk Ironjaw",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 6,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "opp2",
        "team": "orc",
        "role": "lineman",
        "name": "Muzgash Skullkrak",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 8,
          "row": 4
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-002",
    "name": "The Reikland Hand-off",
    "description": "OBJECTIVE: Score with Quickhand. Swiftfoot carries the ball and must complete a Hand-off before Quickhand runs for the End Zone.",
    "activeTeam": "human",
    "published": true,
    "pieces": [
      {
        "id": "thrower",
        "team": "human",
        "role": "thrower",
        "name": "Aldric Swiftfoot",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 3,
        "av": 8,
        "skills": [
          "Pass",
          "Sure Hands"
        ],
        "position": {
          "col": 7,
          "row": 14
        },
        "hasBall": true
      },
      {
        "id": "catcher",
        "team": "human",
        "role": "catcher",
        "name": "Sera Quickhand",
        "ma": 8,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Catch",
          "Dodge"
        ],
        "position": {
          "col": 7,
          "row": 8
        },
        "hasBall": false
      },
      {
        "id": "orc1",
        "team": "orc",
        "role": "lineman",
        "name": "Grukk Ironjaw",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 6,
          "row": 12
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "lineman",
        "name": "Muzgash Skullkrak",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 8,
          "row": 12
        },
        "hasBall": false
      },
      {
        "id": "orc3",
        "team": "orc",
        "role": "blitzer",
        "name": "Vrak Bonecruncher",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 5,
          "row": 9
        },
        "hasBall": false
      },
      {
        "id": "orc4",
        "team": "orc",
        "role": "blitzer",
        "name": "Skrag Headsmash",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 4,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "orc5",
        "team": "orc",
        "role": "lineman",
        "name": "Dorg Gutripper",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 7,
          "row": 5
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-003",
    "name": "Swiftfoot's Long Bomb",
    "description": "OBJECTIVE: Score with Quickhand. Move Swiftfoot clear of the Tackle Zones, then complete the Pass and Catch.",
    "activeTeam": "human",
    "published": true,
    "ballPosition": null,
    "pieces": [
      {
        "id": "thrower",
        "team": "human",
        "role": "thrower",
        "name": "Aldric Swiftfoot",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 3,
        "av": 8,
        "skills": [
          "Pass",
          "Sure Hands"
        ],
        "position": {
          "col": 7,
          "row": 10
        },
        "hasBall": true
      },
      {
        "id": "catcher",
        "team": "human",
        "role": "catcher",
        "name": "Sera Quickhand",
        "ma": 8,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Catch",
          "Dodge"
        ],
        "position": {
          "col": 7,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "orc1",
        "team": "orc",
        "role": "lineman",
        "name": "Grukk Ironjaw",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 6,
          "row": 9
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "lineman",
        "name": "Muzgash Skullkrak",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 8,
          "row": 9
        },
        "hasBall": false
      },
      {
        "id": "orc3",
        "team": "orc",
        "role": "blitzer",
        "name": "Vrak Bonecruncher",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 7,
          "row": 8
        },
        "hasBall": false
      },
      {
        "id": "orc4",
        "team": "orc",
        "role": "lineman",
        "name": "Dorg Gutripper",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 8,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "orc-blocker-7",
        "team": "orc",
        "role": "lineman",
        "name": "Skrag Headsmash",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 4,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "human-lineman-8",
        "team": "human",
        "role": "lineman",
        "name": "Cedric Linebreaker",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [],
        "position": {
          "col": 10,
          "row": 11
        },
        "hasBall": false
      },
      {
        "id": "orc-lineman-9",
        "team": "orc",
        "role": "lineman",
        "name": "Zug Bloodfang",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 11,
          "row": 10
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-004",
    "name": "Ironjaw's Gauntlet",
    "description": "OBJECTIVE: Carry the ball through Ironjaw's defensive line. Every failed Dodge ends the drive.",
    "activeTeam": "human",
    "published": true,
    "pieces": [
      {
        "id": "carrier",
        "team": "human",
        "role": "catcher",
        "name": "Sera Quickhand",
        "ma": 8,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Catch",
          "Dodge"
        ],
        "position": {
          "col": 7,
          "row": 9
        },
        "hasBall": true
      },
      {
        "id": "orc1",
        "team": "orc",
        "role": "lineman",
        "name": "Grukk Ironjaw",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 5,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "lineman",
        "name": "Muzgash Skullkrak",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 9,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "orc3",
        "team": "orc",
        "role": "blitzer",
        "name": "Vrak Bonecruncher",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 7,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "orc4",
        "team": "orc",
        "role": "lineman",
        "name": "Dorg Gutripper",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 4,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "orc5",
        "team": "orc",
        "role": "blitzer",
        "name": "Skrag Headsmash",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 10,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "orc6",
        "team": "orc",
        "role": "blitzer",
        "name": "Zug Bloodfang",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 7,
          "row": 3
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-005",
    "name": "Reikland's Last Stand",
    "description": "OBJECTIVE: Score this turn. Swiftfoot must escape, complete a Hand-off to Quickhand, and clear the remaining defenders.",
    "activeTeam": "human",
    "published": true,
    "pieces": [
      {
        "id": "thrower",
        "team": "human",
        "role": "thrower",
        "name": "Aldric Swiftfoot",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 3,
        "av": 8,
        "skills": [
          "Pass",
          "Sure Hands"
        ],
        "position": {
          "col": 7,
          "row": 11
        },
        "hasBall": true
      },
      {
        "id": "catcher",
        "team": "human",
        "role": "catcher",
        "name": "Sera Quickhand",
        "ma": 8,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Catch",
          "Dodge"
        ],
        "position": {
          "col": 7,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "orc1",
        "team": "orc",
        "role": "lineman",
        "name": "Grukk Ironjaw",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 6,
          "row": 10
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "lineman",
        "name": "Muzgash Skullkrak",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 8,
          "row": 10
        },
        "hasBall": false
      },
      {
        "id": "orc3",
        "team": "orc",
        "role": "blitzer",
        "name": "Vrak Bonecruncher",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 5,
          "row": 8
        },
        "hasBall": false
      },
      {
        "id": "orc4",
        "team": "orc",
        "role": "blitzer",
        "name": "Skrag Headsmash",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 9,
          "row": 8
        },
        "hasBall": false
      },
      {
        "id": "orc5",
        "team": "orc",
        "role": "lineman",
        "name": "Dorg Gutripper",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 6,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "orc6",
        "team": "orc",
        "role": "lineman",
        "name": "Zug Bloodfang",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 8,
          "row": 5
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-006",
    "name": "Loose Ball on the Goal Line",
    "description": "OBJECTIVE: Recover the loose ball and score. Block Skullkrak away from the ball, complete the Pickup, then choose the scoring route.",
    "activeTeam": "human",
    "published": true,
    "ballPosition": {
      "col": 7,
      "row": 5
    },
    "pieces": [
      {
        "id": "aldric",
        "team": "human",
        "role": "thrower",
        "name": "Aldric Swiftfoot",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 3,
        "av": 8,
        "skills": [
          "Pass",
          "Sure Hands"
        ],
        "position": {
          "col": 7,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "cedric",
        "team": "human",
        "role": "blitzer",
        "name": "Cedric Linebreaker",
        "ma": 7,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [
          "Block",
          "Tackle"
        ],
        "position": {
          "col": 6,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "hugo",
        "team": "human",
        "role": "lineman",
        "name": "Hugo Ironlace",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [],
        "position": {
          "col": 5,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "bramm",
        "team": "human",
        "role": "lineman",
        "name": "Bramm Surehands",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [],
        "position": {
          "col": 8,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "dieter",
        "team": "human",
        "role": "lineman",
        "name": "Dieter Longstride",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [],
        "position": {
          "col": 8,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "sera",
        "team": "human",
        "role": "catcher",
        "name": "Sera Quickhand",
        "ma": 8,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Catch",
          "Dodge"
        ],
        "position": {
          "col": 9,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "franz",
        "team": "human",
        "role": "catcher",
        "name": "Franz Quickstep",
        "ma": 8,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Catch",
          "Dodge"
        ],
        "position": {
          "col": 0,
          "row": 0
        },
        "hasBall": false
      },
      {
        "id": "throg",
        "team": "orc",
        "role": "big-un",
        "name": "Throg Chainbellow",
        "ma": 5,
        "st": 4,
        "ag": 2,
        "pa": 6,
        "av": 9,
        "skills": [
          "Mighty Blow",
          "Taunt",
          "Thick Skull",
          "Unsteady"
        ],
        "position": {
          "col": 4,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "nobgul",
        "team": "orc",
        "role": "big-un",
        "name": "Nobgul Linebasher",
        "ma": 5,
        "st": 4,
        "ag": 2,
        "pa": 6,
        "av": 9,
        "skills": [
          "Mighty Blow",
          "Taunt",
          "Thick Skull",
          "Unsteady"
        ],
        "position": {
          "col": 5,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "muzgash",
        "team": "orc",
        "role": "lineman",
        "name": "Muzgash Skullkrak",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 6,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "dorg",
        "team": "orc",
        "role": "lineman",
        "name": "Dorg Gutripper",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 9,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "zug",
        "team": "orc",
        "role": "lineman",
        "name": "Zug Bloodfang",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 10,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "vrak",
        "team": "orc",
        "role": "blitzer",
        "name": "Vrak Bonecruncher",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 10,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "rukbad",
        "team": "orc",
        "role": "lineman",
        "name": "Rukbad Bootsnappa",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 1,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "skrag",
        "team": "orc",
        "role": "blitzer",
        "name": "Skrag Headsmash",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [
          "Block",
          "Break Tackle"
        ],
        "position": {
          "col": 4,
          "row": 1
        },
        "hasBall": false
      },
      {
        "id": "grukk",
        "team": "orc",
        "role": "lineman",
        "name": "Grukk Ironjaw",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 9,
        "skills": [],
        "position": {
          "col": 7,
          "row": 1
        },
        "hasBall": false
      }
    ]
  }
];

export const STATIC_SERIES = {
  "id": "default",
  "name": "Tutorial",
  "description": "Six drills cover Movement, Dodging, Hand-offs, Passing, Blocking, Pickups, and Parallel Universes. Score a touchdown in each drill.",
  "scenarioIds": [
    "scenario-001",
    "scenario-004",
    "scenario-002",
    "scenario-003",
    "scenario-005",
    "scenario-006"
  ]
};
