# Nikke Manager Extension

A Chrome extension that fetches equipment and character data for all your NIKKE characters directly from [blablalink.com](https://www.blablalink.com) and imports it straight into the [Nikke Manager](https://github.com/PilgrimWorks/Nikke-Manager) app — no manual data entry needed.

**Chrome Web Store:** [Nikke Manager Extension](https://chromewebstore.google.com/detail/nikke-manager/lkmibckbphaagkihbdmncaffedkkcmjp)  
**Main app repo:** [github.com/PilgrimWorks/Nikke-Manager](https://github.com/PilgrimWorks/Nikke-Manager)  
**Live app:** https://pilgrimworks.github.io/Nikke-Manager

---

## Requirements

- A [blablalink.com](https://www.blablalink.com) account linked to your NIKKE game
- Google Chrome (or any Chromium-based browser)

## Installation

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/nikke-manager/lkmibckbphaagkihbdmncaffedkkcmjp). The Nikke Manager icon will appear in your toolbar.

## Usage

1. Log in to [blablalink.com](https://www.blablalink.com) in Chrome
2. Click the **Nikke Manager** icon in your toolbar
3. Click **Import Data** and wait around 10 seconds
4. The extension automatically opens the Nikke Manager app and imports your data

If you are not logged in, a login button will appear — click it to open the login page, log in, then click **Import Data** again.

The popup also has a **Download Data** button to save your fetched data as a file. This is useful as a manual backup or for importing into the app via the **My Data** menu.

---

## What gets imported

The extension fetches the following data for every character in your account:

**Character fields:**

| Field        | Description                                      |
| ------------ | ------------------------------------------------ |
| `name`       | Character name                                   |
| `level`      | Character level                                  |
| `power`      | Combat power (CP)                                |
| `bond`       | Bond / affection level                           |
| `cores`      | Core count                                       |
| `limitBreak` | Number of limit breaks applied                   |
| `skill1`     | Skill 1 level                                    |
| `skill2`     | Skill 2 level                                    |
| `ultiSkill`  | Ultimate skill level                             |
| `cube`       | Equipped Harmony Cube — `{ tid, lv }` or null    |
| `doll`       | Equipped Collection Doll — `{ tid, lv }` or null |

**Gear slots** (`Helmet`, `Chest`, `Gloves`, `Combat Boots`):

| Field   | Description                                    |
| ------- | ---------------------------------------------- |
| `lv`    | Gear piece upgrade level                       |
| `tier`  | Gear piece tier                                |
| `lines` | Three stat lines — unoccupied lines are `null` |

Each occupied stat line is `{ "stat": "<name>", "value": <number>, "display": "<percent>" }`.

Stat names: `ATK`, `Elemental Dmg`, `Hit Rate`, `Charge Dmg`, `Charge Speed`, `Critical Rate`, `Critical Dmg`, `Max Ammo`, `DEF`.
