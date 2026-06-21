# Nikke Manager Extension

Fetches data for all your NIKKE characters directly from Chrome.
No Node.js or command-line tools required.

## Installation

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked** and select this `extension` folder
4. The Nikke Manager icon will appear in your toolbar

> Chrome may show a warning about developer mode extensions on startup -- this is normal
> for extensions loaded this way. Click "Cancel" to dismiss it.

## Requirements

- A [blablalink.com](https://www.blablalink.com) account linked to your NIKKE game
- Must be logged in to blablalink.com in Chrome

## Usage

1. Log in to [blablalink.com](https://www.blablalink.com) in Chrome if you have not already
2. Click the Nikke Manager icon in your toolbar
3. Click **Fetch Data** and wait around 10 seconds
4. Click **Download JSON** to save `nikke-equips.json`

If you are not logged in, a login button will appear - click it to open the login page,
log in, then click Fetch Data again.

Your data is cached in the extension after each fetch, so Download JSON works any time
without re-fetching.

## Output Format

`nikke-equips.json` is structured as:

```json
{
  "16": {
    "name": "Rapi: Red Hood",
    "level": 160,
    "power": 123456,
    "bond": 40,
    "cores": 7,
    "limitBreak": 3,
    "skill1": 10,
    "skill2": 10,
    "ultiSkill": 10,
    "cube": { "tid": 1001, "lv": 15 },
    "doll": { "tid": 2001, "lv": 5 },
    "Helmet": {
      "lv": 5,
      "tier": 2,
      "lines": [
        { "stat": "ATK", "value": 1.96, "display": "1.96%" },
        null,
        { "stat": "Critical Rate", "value": 1.36, "display": "1.36%" }
      ]
    },
    "Chest": { ... },
    "Gloves": { ... },
    "Combat Boots": { ... }
  },
  ...
}
```

**Top-level fields per character:**

| Field        | Type           | Description                                                  |
| ------------ | -------------- | ------------------------------------------------------------ |
| `name`       | string         | Character name                                               |
| `level`      | number         | Character level                                              |
| `power`      | number         | Combat power (CP)                                            |
| `bond`       | number         | Bond / affection level                                       |
| `cores`      | number         | Core count                                                   |
| `limitBreak` | number         | Number of limit breaks applied (`grade` in API)              |
| `skill1`     | number         | Skill 1 level                                                |
| `skill2`     | number         | Skill 2 level                                                |
| `ultiSkill`  | number         | Ultimate skill level                                         |
| `cube`       | object \| null | Equipped Harmony Cube — `{ tid, lv }` — or `null` if none    |
| `doll`       | object \| null | Equipped Collection Doll — `{ tid, lv }` — or `null` if none |

**Gear slot fields** (`Helmet`, `Chest`, `Gloves`, `Combat Boots`):

| Field   | Type     | Description                                    |
| ------- | -------- | ---------------------------------------------- |
| `lv`    | number   | Gear piece upgrade level                       |
| `tier`  | number   | Gear piece tier                                |
| `lines` | array[3] | Three stat lines — unoccupied lines are `null` |

Each occupied line is `{ "stat": "<name>", "value": <number>, "display": "<percent>" }`.

Stat names used: `ATK`, `Element DMG`, `Hit Rate`, `Charge DMG`, `Charge Speed`, `Critical Rate`, `Critical DMG`, `Max Ammo`, `DEF`.

Characters with no gear equipped are included with no slot keys.
