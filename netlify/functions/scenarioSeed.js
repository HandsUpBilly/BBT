// GENERATED FILE — do not edit.
// Produced by scripts/generate-scenario-seed.mjs from:
//   client/src/scenarios/*.json  (7 files)
//   client/src/series/*.json  (1 file)
// Regenerate with: npm run generate:seed

export const STATIC_SCENARIOS = [
  {
    "id": "scenario-001",
    "name": "Reikland's Opening Drive",
    "description": "Nuffle smiles on the Reavers' first snap. Swiftfoot has the ball but a wall of Orcs stand between him and glory.\n\nFind the safest path to the end zone.",
    "activeTeam": "human",
    "teams": [
      "human",
      "orc"
    ],
    "objective": "touchdown",
    "enabledActions": [
      "move"
    ],
    "freePlay": false,
    "published": true,
    "ballPosition": null,
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
          "Block"
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
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 6,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "opp2",
        "team": "orc",
        "role": "blocker",
        "name": "Muzgash Skullkrak",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 8,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "orc-blocker-4",
        "team": "orc",
        "role": "lineman",
        "name": "Vrak Bonecruncher",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 12,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "orc-blocker-5",
        "team": "orc",
        "role": "blocker",
        "name": "Dorg Gutripper",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 3,
          "row": 2
        },
        "hasBall": false
      },
      {
        "id": "human-lineman-6",
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
          "col": 3,
          "row": 11
        },
        "hasBall": false
      },
      {
        "id": "human-lineman-7",
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
          "col": 11,
          "row": 11
        },
        "hasBall": false
      },
      {
        "id": "orc-troll-8",
        "team": "orc",
        "role": "troll",
        "name": "Ugthar Slabjaw 2",
        "ma": 4,
        "st": 5,
        "ag": 1,
        "pa": 5,
        "av": 9,
        "skills": [
          "Always Hungry",
          "Loner (4+)",
          "Mighty Blow",
          "Projectile Vomit",
          "Really Stupid",
          "Regeneration",
          "Throw Team Mate"
        ],
        "position": {
          "col": 7,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "orc-goblin-9",
        "team": "orc",
        "role": "goblin",
        "name": "Zag Nosebiter 2",
        "ma": 6,
        "st": 2,
        "ag": 3,
        "pa": 3,
        "av": 7,
        "skills": [
          "Dodge",
          "Right Stuff",
          "Stunty"
        ],
        "position": {
          "col": 8,
          "row": 2
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-002",
    "name": "The Reikland Handoff",
    "description": "Swiftfoot can't carry it home alone this time. Feed the ball to Quickhand and dodge her clear of the green-skin line before Nuffle changes his mind.",
    "activeTeam": "human",
    "teams": [
      "human",
      "orc"
    ],
    "objective": "touchdown",
    "enabledActions": [
      "move",
      "handoff"
    ],
    "freePlay": false,
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
          "Block"
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
        "st": 2,
        "ag": 4,
        "pa": 5,
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
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 6,
          "row": 12
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "blocker",
        "name": "Muzgash Skullkrak",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
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
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
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
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
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
        "role": "blocker",
        "name": "Dorg Gutripper",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
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
    "description": "Ironjaw's boys have shut the ground game down cold. Step clear of their tackle zones and launch a long pass downfield to Quickhand before the whistle blows.",
    "activeTeam": "human",
    "teams": [
      "human",
      "orc"
    ],
    "objective": "touchdown",
    "enabledActions": [
      "move",
      "handoff",
      "pass"
    ],
    "freePlay": false,
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
          "Block"
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
        "st": 2,
        "ag": 4,
        "pa": 5,
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
        "role": "thrower",
        "name": "Grukk Ironjaw",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 6,
          "row": 9
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "blocker",
        "name": "Muzgash Skullkrak",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 8,
          "row": 9
        },
        "hasBall": false
      },
      {
        "id": "orc3",
        "team": "orc",
        "role": "troll",
        "name": "Vrak Bonecruncher",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
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
        "role": "blocker",
        "name": "Dorg Gutripper",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 8,
          "row": 3
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-004",
    "name": "Ironjaw's Gauntlet",
    "description": "A full line of Orcs - Bonecruncher, Gutripper, and the rest of Ironjaw's crew stands between your ball carrier and glory. Thread the tackle zones; one bad dodge ends the drive.",
    "activeTeam": "human",
    "teams": [
      "human",
      "orc"
    ],
    "objective": "touchdown",
    "enabledActions": [
      "move",
      "handoff",
      "pass"
    ],
    "freePlay": false,
    "published": true,
    "ballPosition": null,
    "pieces": [
      {
        "id": "carrier",
        "team": "human",
        "role": "catcher",
        "name": "Sera Quickhand",
        "ma": 8,
        "st": 2,
        "ag": 4,
        "pa": 5,
        "av": 7,
        "skills": [
          "Catch",
          "Dodge"
        ],
        "position": {
          "col": 7,
          "row": 8
        },
        "hasBall": true
      },
      {
        "id": "orc1",
        "team": "orc",
        "role": "lineman",
        "name": "Grukk Ironjaw",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 2,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "lineman",
        "name": "Muzgash Skullkrak",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 10,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "orc3",
        "team": "orc",
        "role": "goblin",
        "name": "Vrak Bonecruncher",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
        ],
        "position": {
          "col": 5,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "orc4",
        "team": "orc",
        "role": "blocker",
        "name": "Dorg Gutripper",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 3,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "orc5",
        "team": "orc",
        "role": "blocker",
        "name": "Skrag Headsmash",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
        ],
        "position": {
          "col": 11,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "orc6",
        "team": "orc",
        "role": "troll",
        "name": "Zug Bloodfang",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
        ],
        "position": {
          "col": 8,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "human-catcher-8",
        "team": "human",
        "role": "catcher",
        "name": "Bramm Surehands",
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
          "col": 3,
          "row": 5
        },
        "hasBall": false
      }
    ]
  },
  {
    "id": "scenario-005",
    "name": "Who do you think you're pushing around?",
    "description": "Last chance for the score. Swiftfoot must dodge free and hand off to Quickhand, who still has to beat blitzers Bonecruncher and Headsmash to the line.",
    "activeTeam": "human",
    "teams": [
      "human",
      "orc"
    ],
    "objective": "touchdown",
    "enabledActions": [
      "move",
      "handoff",
      "pass",
      "block",
      "blitz"
    ],
    "freePlay": false,
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
          "Block"
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
        "st": 2,
        "ag": 4,
        "pa": 5,
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
        "role": "blocker",
        "name": "Grukk Ironjaw",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 6,
          "row": 10
        },
        "hasBall": false
      },
      {
        "id": "orc2",
        "team": "orc",
        "role": "blocker",
        "name": "Muzgash Skullkrak",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
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
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
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
        "pa": 5,
        "av": 9,
        "skills": [
          "Block"
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
        "role": "goblin",
        "name": "Dorg Gutripper",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
        "position": {
          "col": 6,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "orc6",
        "team": "orc",
        "role": "goblin",
        "name": "Zug Bloodfang",
        "ma": 4,
        "st": 3,
        "ag": 3,
        "pa": 6,
        "av": 9,
        "skills": [
          "Animosity"
        ],
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
    "name": "Things are getting serious",
    "description": "Bonecruncher's hit jarred the ball loose five squares short of the line, and Skullkrak is guarding it. Knock him away, scoop it up, then pick your route home - Swiftfoot's legs, Quickstep waiting across the paint, or Quickhand breaking from the slot.",
    "activeTeam": "human",
    "teams": [
      "human",
      "orc"
    ],
    "objective": "touchdown",
    "enabledActions": [
      "move",
      "handoff",
      "pass",
      "block",
      "blitz"
    ],
    "freePlay": true,
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
  },
  {
    "id": "scenario-007",
    "name": "Got to pay the Troll toll",
    "description": "Leopold  is in trouble, can you extract him from under the arms of Brakk the troll and find a path to score.",
    "activeTeam": "imperial-nobility",
    "teams": [
      "imperial-nobility",
      "black-orc"
    ],
    "objective": "touchdown",
    "enabledActions": [
      "move",
      "handoff",
      "pass",
      "block",
      "blitz"
    ],
    "freePlay": true,
    "published": true,
    "ballPosition": null,
    "pieces": [
      {
        "id": "black-orc-troll-1",
        "team": "black-orc",
        "role": "troll",
        "name": "Brakk Stonegut",
        "ma": 4,
        "st": 5,
        "ag": 1,
        "pa": 5,
        "av": 9,
        "skills": [
          "Always Hungry",
          "Mighty Blow",
          "Projectile Vomit",
          "Really Stupid",
          "Regeneration",
          "Throw Team Mate"
        ],
        "position": {
          "col": 6,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "black-orc-black-orc-2",
        "team": "black-orc",
        "role": "black-orc",
        "name": "Drazh Necksnappa",
        "ma": 4,
        "st": 4,
        "ag": 2,
        "pa": 5,
        "av": 9,
        "skills": [
          "Brawler",
          "Grab"
        ],
        "position": {
          "col": 7,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "black-orc-black-orc-3",
        "team": "black-orc",
        "role": "black-orc",
        "name": "Uzgul Grimtusk",
        "ma": 4,
        "st": 4,
        "ag": 2,
        "pa": 5,
        "av": 9,
        "skills": [
          "Brawler",
          "Grab"
        ],
        "position": {
          "col": 9,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "black-orc-black-orc-4",
        "team": "black-orc",
        "role": "black-orc",
        "name": "Kragga Chainfist",
        "ma": 4,
        "st": 4,
        "ag": 2,
        "pa": 5,
        "av": 9,
        "skills": [
          "Brawler",
          "Grab"
        ],
        "position": {
          "col": 5,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "black-orc-black-orc-5",
        "team": "black-orc",
        "role": "black-orc",
        "name": "Borzag Blackhide",
        "ma": 4,
        "st": 4,
        "ag": 2,
        "pa": 5,
        "av": 9,
        "skills": [
          "Brawler",
          "Grab"
        ],
        "position": {
          "col": 4,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-thrower-6",
        "team": "imperial-nobility",
        "role": "thrower",
        "name": "Leopold von Draken",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 2,
        "av": 8,
        "skills": [
          "Give and Go",
          "Pass",
          "Pro"
        ],
        "position": {
          "col": 6,
          "row": 6
        },
        "hasBall": true
      },
      {
        "id": "black-orc-black-orc-7",
        "team": "black-orc",
        "role": "black-orc",
        "name": "Grishnak Redmaw",
        "ma": 4,
        "st": 4,
        "ag": 2,
        "pa": 5,
        "av": 9,
        "skills": [
          "Brawler",
          "Grab"
        ],
        "position": {
          "col": 7,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "black-orc-goblin-8",
        "team": "black-orc",
        "role": "goblin",
        "name": "Krib Toepoker 2",
        "ma": 6,
        "st": 2,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Dodge",
          "Right Stuff",
          "Stunty",
          "Thick Skull"
        ],
        "position": {
          "col": 10,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "black-orc-goblin-9",
        "team": "black-orc",
        "role": "goblin",
        "name": "Nizz Grubsnatcher 2",
        "ma": 6,
        "st": 2,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Dodge",
          "Right Stuff",
          "Stunty",
          "Thick Skull"
        ],
        "position": {
          "col": 5,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "black-orc-black-orc-10",
        "team": "black-orc",
        "role": "black-orc",
        "name": "Uzgul Grimtusk 2",
        "ma": 4,
        "st": 4,
        "ag": 2,
        "pa": 5,
        "av": 9,
        "skills": [
          "Brawler",
          "Grab"
        ],
        "position": {
          "col": 3,
          "row": 4
        },
        "hasBall": false
      },
      {
        "id": "black-orc-goblin-11",
        "team": "black-orc",
        "role": "goblin",
        "name": "Zag Nosebiter 3",
        "ma": 6,
        "st": 2,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Dodge",
          "Right Stuff",
          "Stunty",
          "Thick Skull"
        ],
        "position": {
          "col": 8,
          "row": 3
        },
        "hasBall": false
      },
      {
        "id": "black-orc-goblin-12",
        "team": "black-orc",
        "role": "goblin",
        "name": "Krib Toepoker 3",
        "ma": 6,
        "st": 2,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Dodge",
          "Right Stuff",
          "Stunty",
          "Thick Skull"
        ],
        "position": {
          "col": 11,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-ogre-13",
        "team": "imperial-nobility",
        "role": "ogre",
        "name": "Grod Ribcracker",
        "ma": 5,
        "st": 5,
        "ag": 2,
        "pa": 5,
        "av": 9,
        "skills": [
          "Bone Head",
          "Loner (3+)",
          "Mighty Blow",
          "Thick Skull",
          "Throw Team Mate"
        ],
        "position": {
          "col": 8,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-bodyguard-14",
        "team": "imperial-nobility",
        "role": "bodyguard",
        "name": "Otto Eisenhelm",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [
          "Stand Firm",
          "Wrestle"
        ],
        "position": {
          "col": 9,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-bodyguard-15",
        "team": "imperial-nobility",
        "role": "bodyguard",
        "name": "Mathias Falken",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [
          "Stand Firm",
          "Wrestle"
        ],
        "position": {
          "col": 8,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-retainer-16",
        "team": "imperial-nobility",
        "role": "retainer",
        "name": "Konrad Hochmark",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Fend"
        ],
        "position": {
          "col": 13,
          "row": 6
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-noble-blitzer-17",
        "team": "imperial-nobility",
        "role": "noble-blitzer",
        "name": "Lukas Silberhand",
        "ma": 7,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [
          "Block",
          "Catch",
          "Pro"
        ],
        "position": {
          "col": 5,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-retainer-18",
        "team": "imperial-nobility",
        "role": "retainer",
        "name": "Rudolf Drachenfels",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Fend"
        ],
        "position": {
          "col": 6,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-retainer-19",
        "team": "imperial-nobility",
        "role": "retainer",
        "name": "Viktor Sternbach",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Fend"
        ],
        "position": {
          "col": 4,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-noble-blitzer-20",
        "team": "imperial-nobility",
        "role": "noble-blitzer",
        "name": "Leopold von Draken 2",
        "ma": 7,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [
          "Block",
          "Catch",
          "Pro"
        ],
        "position": {
          "col": 12,
          "row": 5
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-bodyguard-21",
        "team": "imperial-nobility",
        "role": "bodyguard",
        "name": "Alaric Goldcrest 2",
        "ma": 5,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 8,
        "skills": [
          "Stand Firm",
          "Wrestle"
        ],
        "position": {
          "col": 7,
          "row": 7
        },
        "hasBall": false
      },
      {
        "id": "imperial-nobility-retainer-22",
        "team": "imperial-nobility",
        "role": "retainer",
        "name": "Otto Eisenhelm 2",
        "ma": 6,
        "st": 3,
        "ag": 3,
        "pa": 4,
        "av": 7,
        "skills": [
          "Fend"
        ],
        "position": {
          "col": 3,
          "row": 6
        },
        "hasBall": false
      }
    ]
  }
];

export const STATIC_SERIES = [
  {
    "id": "default",
    "name": "The Nuffle Shuffle",
    "description": "Lead the Reikland attack through green-skin pressure, chain the cleanest route, and cross the line before the Orcs turn the drive into a scrum.",
    "scenarioIds": [
      "scenario-001",
      "scenario-002",
      "scenario-003",
      "scenario-004",
      "scenario-005",
      "scenario-006"
    ],
    "label": "Tutorial",
    "published": true,
    "teams": [
      "human",
      "orc"
    ],
    "order": 0,
    "logo": "data:image/webp;base64,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"
  }
];
