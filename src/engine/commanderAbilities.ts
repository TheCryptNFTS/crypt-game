
"cardId": "unit_stone_guard",
"instanceId": "unit_j3gprj86"
}

=== EVENT: HERO_ATTACKED ===
{
"type": "HERO_ATTACKED",
"attackerId": "unit_j3gprj86",
"defenderPlayerId": "P2",
"damage": 3
}

=== TEST 5: WIN CONDITION ===
{
"turn": 1,
"activePlayer": "P1",
"phase": "combat",
"winner": "P1",
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 8,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [
      "spell_firebolt",
      "spell_insight",
      "spell_battle_blessing",
      "spell_mend"
    ],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_j3gprj86",
          "cardId": "unit_stone_guard",
          "lane": "front",
          "attack": 3,
          "health": 12,
          "speed": 2,
          "armor": 0,
          "keywords": [],
          "exhausted": true,
          "summoningSick": false
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  },
  "P2": {
    "id": "P2",
    "health": -1,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [
      "unit_bronze_scout",
      "spell_execute",
      "eq_axe"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  }
}
}
billy@Williams-MacBook-Air crypt-game % mkdir -p src/engine
touch src/engine/commanderAbilities.ts
billy@Williams-MacBook-Air crypt-game % git add .
git commit -m "Add taunt rush turn-flow tests and commander summaries"
npx ts-node src/index.ts
[main e880118] Add taunt rush turn-flow tests and commander summaries
2 files changed, 208 insertions(+), 182 deletions(-)
create mode 100644 src/engine/commanderAbilities.ts

=== TEST 1 START: TAUNT SETUP ===
{
"turn": 1,
"activePlayer": "P2",
"phase": "main",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [
      "unit_shield_bearer"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [
      "unit_bronze_scout"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  }
}
}

=== EVENT: UNIT_PLAYED ===
{
"type": "UNIT_PLAYED",
"playerId": "P1",
"cardId": "unit_shield_bearer",
"instanceId": "unit_ilzxuxo5"
}

=== EVENT: UNIT_PLAYED ===
{
"type": "UNIT_PLAYED",
"playerId": "P2",
"cardId": "unit_bronze_scout",
"instanceId": "unit_vyyh94ae"
}

=== TEST 1 BEFORE HERO ATTACK WITH ENEMY TAUNT ===
{
"turn": 1,
"activePlayer": "P2",
"phase": "combat",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 7,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_ilzxuxo5",
          "cardId": "unit_shield_bearer",
          "lane": "front",
          "attack": 2,
          "health": 15,
          "speed": 1,
          "armor": 0,
          "keywords": [
            "TAUNT"
          ],
          "exhausted": false,
          "summoningSick": true
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 9,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_vyyh94ae",
          "cardId": "unit_bronze_scout",
          "lane": "front",
          "attack": 3,
          "health": 8,
          "speed": 4,
          "armor": 0,
          "keywords": [
            "RUSH"
          ],
          "exhausted": false,
          "summoningSick": false
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  }
}
}

=== TEST 1 RESULT ===
TAUNT correctly blocked hero attack
Error: Cannot attack hero while enemy TAUNT unit exists

=== TEST 2 START: RUSH SETUP ===
{
"turn": 1,
"activePlayer": "P2",
"phase": "main",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [
      "unit_stone_guard",
      "spell_firebolt",
      "spell_insight",
      "spell_battle_blessing",
      "spell_mend"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [
      "unit_bronze_scout"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  }
}
}

=== EVENT: UNIT_PLAYED ===
{
"type": "UNIT_PLAYED",
"playerId": "P2",
"cardId": "unit_bronze_scout",
"instanceId": "unit_mjhaipc6"
}

=== EVENT: HERO_ATTACKED ===
{
"type": "HERO_ATTACKED",
"attackerId": "unit_mjhaipc6",
"defenderPlayerId": "P1",
"damage": 3
}

=== TEST 2 AFTER RUSH HERO ATTACK ===
{
"turn": 1,
"activePlayer": "P2",
"phase": "combat",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 27,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [
      "unit_stone_guard",
      "spell_firebolt",
      "spell_insight",
      "spell_battle_blessing",
      "spell_mend"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 9,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_mjhaipc6",
          "cardId": "unit_bronze_scout",
          "lane": "front",
          "attack": 3,
          "health": 8,
          "speed": 4,
          "armor": 0,
          "keywords": [
            "RUSH"
          ],
          "exhausted": true,
          "summoningSick": false
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  }
}
}

=== TEST 3 START: NON-RUSH SETUP ===
{
"turn": 1,
"activePlayer": "P1",
"phase": "main",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [
      "unit_stone_guard"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [
      "unit_bronze_scout",
      "spell_execute",
      "eq_axe"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  }
}
}

=== EVENT: UNIT_PLAYED ===
{
"type": "UNIT_PLAYED",
"playerId": "P1",
"cardId": "unit_stone_guard",
"instanceId": "unit_g3qo9g94"
}

=== TEST 3 BEFORE NON-RUSH HERO ATTACK ===
{
"turn": 1,
"activePlayer": "P1",
"phase": "combat",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 8,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_g3qo9g94",
          "cardId": "unit_stone_guard",
          "lane": "front",
          "attack": 3,
          "health": 12,
          "speed": 2,
          "armor": 0,
          "keywords": [],
          "exhausted": false,
          "summoningSick": true
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [
      "unit_bronze_scout",
      "spell_execute",
      "eq_axe"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  }
}
}

=== TEST 3 RESULT ===
Non-RUSH unit correctly blocked by summoning sickness
Error: Attacker has summoning sickness

=== TEST 4 START: TURN FLOW SETUP ===
{
"turn": 1,
"activePlayer": "P1",
"phase": "main",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [
      "unit_stone_guard"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 10,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [
      "unit_bronze_scout"
    ],
    "discard": [],
    "board": {
      "front": [],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  }
}
}

=== EVENT: UNIT_PLAYED ===
{
"type": "UNIT_PLAYED",
"playerId": "P1",
"cardId": "unit_stone_guard",
"instanceId": "unit_ezyx17co"
}

=== EVENT: UNIT_PLAYED ===
{
"type": "UNIT_PLAYED",
"playerId": "P2",
"cardId": "unit_bronze_scout",
"instanceId": "unit_qunjps2u"
}

=== TEST 4 BEFORE END TURN ===
{
"turn": 1,
"activePlayer": "P2",
"phase": "main",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 8,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_ezyx17co",
          "cardId": "unit_stone_guard",
          "lane": "front",
          "attack": 3,
          "health": 12,
          "speed": 2,
          "armor": 0,
          "keywords": [],
          "exhausted": false,
          "summoningSick": true
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 9,
    "maxEnergy": 10,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "unit_blade_striker",
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_qunjps2u",
          "cardId": "unit_bronze_scout",
          "lane": "front",
          "attack": 3,
          "health": 8,
          "speed": 4,
          "armor": 0,
          "keywords": [
            "RUSH"
          ],
          "exhausted": true,
          "summoningSick": true
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  }
}
}

=== EVENT: TURN_END ===
{
"type": "TURN_END",
"playerId": "P1"
}

=== EVENT: TURN_START ===
{
"type": "TURN_START",
"playerId": "P2"
}

=== TEST 4 AFTER END TURN / NEXT TURN START ===
{
"turn": 2,
"activePlayer": "P2",
"phase": "main",
"winner": null,
"players": {
  "P1": {
    "id": "P1",
    "health": 30,
    "energy": 8,
    "maxEnergy": 10,
    "commanderId": "cmd_stone_warden",
    "deck": [
      "unit_stone_brute",
      "eq_riot_shield",
      "unit_stone_guard",
      "eq_heavy_plate"
    ],
    "hand": [],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_ezyx17co",
          "cardId": "unit_stone_guard",
          "lane": "front",
          "attack": 3,
          "health": 12,
          "speed": 2,
          "armor": 0,
          "keywords": [],
          "exhausted": false,
          "summoningSick": true
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": true
    }
  },
  "P2": {
    "id": "P2",
    "health": 30,
    "energy": 7,
    "maxEnergy": 7,
    "commanderId": "cmd_bronze_raider",
    "deck": [
      "eq_speed_boots",
      "unit_berserker"
    ],
    "hand": [
      "unit_blade_striker"
    ],
    "discard": [],
    "board": {
      "front": [
        {
          "instanceId": "unit_qunjps2u",
          "cardId": "unit_bronze_scout",
          "lane": "front",
          "attack": 3,
          "health": 8,
          "speed": 4,
          "armor": 0,
          "keywords": [
            "RUSH"
          ],
          "exhausted": false,
          "summoningSick": false
        }
      ],
      "back": []
    },
    "turnFlags": {
      "firstUnitCostReduction": 0,
      "firstUnitPlayed": false
    }
  }
}
}

=== TEST 5 COMMANDER PASSIVE SUMMARIES ===
{
stone_warden: 'Stone Warden: Defensive commander. Built for tanky boards and sustain.',
bronze_raider: 'Bronze Raider: Aggressive commander. Built for speed, pressure, and fast damage.',
hell_judge: 'Hell Judge: Shadow commander. Built for infernal pressure and lifesteal-style combat.'
}
billy@Williams-MacBook-Air crypt-game % 