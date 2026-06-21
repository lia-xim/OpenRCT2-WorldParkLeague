# OpenRCT2 World Park League

<div align="center">

Turn OpenRCT2 into a living global park economy with rivalry, prestige, market pressure, investments, and endgame competition.

[![CI](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/actions/workflows/ci.yml/badge.svg)](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/lia-xim/OpenRCT2-WorldParkLeague)](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/releases)
[![OpenRCT2](https://img.shields.io/badge/OpenRCT2-Plugin-2f855a)](https://openrct2.io/)

[Download Latest Release](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/releases) | [Report a Bug](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/issues/new/choose) | [Balance Feedback](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/issues/new/choose) | [Contributing Guide](./CONTRIBUTING.md)

</div>

> **World Park League** adds the missing meta-game around your park.  
> You are no longer building in isolation. You are climbing through a global field of rival parks, fighting for people share, reacting to industry events, managing prestige, winning spotlight moments, and dealing with real pressure to stay ahead.

## Why this exists

OpenRCT2 already nails the park-building sandbox.  
What it often lacks in longer saves is a bigger world reacting to what you do.

World Park League is built to solve that.

It adds:

- a `50`-park living league that updates every day
- local rivals that compete directly with you for attention
- difficulty presets from relaxed to punishing
- active target tasks with deadlines, rewards, and real penalties
- a first-run guide that explains what matters before the player sees the full economy
- prestige, yearly recaps, achievements, and long-term progression
- a park-cash economy layer with one unified rival portfolio, real payouts, losses, penalties, and pressure
- a management layer with buybacks, governance, and rewards
- rivalry pressure that gives late-game parks something meaningful to fight for

The goal is not to replace OpenRCT2.  
It is to make long-running saves feel alive for much longer.

## Why players install it

This plugin is for you if you want:

- a reason to care about your rank beyond raw money
- more endgame pressure once your park is already successful
- rival parks that feel like actual competitors instead of background flavor
- visible surges, awards, challenges, and story beats
- a stronger sense that your park exists inside a wider theme park industry

## At a glance

| Area | What it adds |
| --- | --- |
| Global competition | 50 simulated parks, daily movement, major world events, mergers, bankruptcies, recoveries, expansion waves |
| Player pressure | difficulty presets, active target tasks, people share, guest-cap pressure, score races, local rivals, spotlight and buzz swings |
| Management layer | park-cash-funded rival portfolio, dividends, exits, negative investment shocks, challenge penalties, buybacks, governance pressure |
| Progression | prestige goals, achievement rewards, yearly recap, records, trend charts, park-finance trend visibility, progress filters |
| Rival storytelling | first-run guide, primary rivals, watchlist alerts, head-to-head challenges, paced warning popups, analyst guidance, league headlines |

## What makes it feel different

Instead of a static overlay, World Park League behaves more like a strategy layer running above your save:

- when you climb, rivals react
- when you dominate, the pressure gets stronger
- when you slip, others take your crowd share
- when you win big, the spotlight can flood your park with attention
- when a rival catches fire, you feel it immediately

That is the fantasy: not just a better spreadsheet, but a better story.

## Core feature tour

### Global league

- `50` simulated parks with different identities and trajectories
- regional market profiles and world mood shifts
- daily league movement with larger event cycles layered on top
- mergers, exits, scandals, recoveries, and industry shakeups

### Local rivalry

- direct local rivals that mirror your competitive lane
- head-to-head challenge system with rewards and pressure
- visible warning popups when rivals attack your position
- rivalry tracking in both the main UI and prestige flows
- alerts when a rival surges, weakens, or becomes vulnerable

### Difficulty and active objectives

- choose `Casual`, `Normal`, `Hard`, or `Tycoon` from the main window
- receive timed park tasks such as guest growth, rating recovery, profit pushes, or expansion briefs
- complete objectives for park-cash rewards and temporary momentum
- fail objectives and lose real park cash while board and investor confidence take a hit
- track active objectives and rival pressure in the compact challenge timeline
- use `npm run analyze:balance:difficulty` during development to compare all difficulty presets across the same scenarios

### Management and economy

- invest park cash into other parks through one unified league portfolio
- receive dividends, handle merger carry-over, forced exits, and negative investment outcomes
- lose real park cash when head-to-head rival challenges fail
- track park cash, portfolio value, league worth, and active pressure in the live UI
- manage equity offers, buybacks, and governance pressure
- use management actions to push for momentum or stability

### Progression and prestige

- prestige goals and achievement rewards with real gameplay impact
- yearly recaps with standout rivals and key moments
- lifetime records and next-unlock guidance
- trend charts, filters, and progression visibility

## Install in 30 seconds

1. Open the [Releases page](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/releases)
2. Download the latest standalone plugin file:

```text
WorldParkLeague-v<version>.js
```

3. Place it into:

```text
Documents/OpenRCT2/plugin
```

4. Start OpenRCT2
5. Open `World Park League` from the in-game plugin menu

That is the full install.

If you prefer a bundle, each release also includes a ZIP with:

- `WorldParkLeague.js`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`

## In-game UI

The main window is designed around two reading styles:

- `Simple`: easier to scan while playing
- `Advanced`: deeper management and analysis

The default view now focuses on the next actionable things: current rank, park cash, profit, active goal, boost state, difficulty, current risk, and the weakest score driver. Deeper finance and rival context lives behind `Money`, `Rivals`, and `Goals`.

On the first open, the plugin shows a short quick-start window. Important warning popups are then paced so major rival attacks and failed objectives are visible without spamming the player.

The shipped release UI is the real player-facing design.  
Visible debug controls are intentionally removed from the public release experience.

## Current release status

The plugin is feature-rich, installable, and publicly releasable today.

The main remaining refinement area is long-run balance, especially:

- top-end snowballing
- long-hold investment ROI
- extended real-save validation across small, midgame, and dominant parks
- deeper challenge and rival-pressure tuning across real saves

So the foundation is strong, but balancing is still being actively improved.

## Compatibility

- OpenRCT2 scripting plugin
- developed and tested against modern OpenRCT2 builds
- built with Node.js `20+`

If something behaves differently on a specific OpenRCT2 version, please include the exact build when reporting it.

## For players who want to go deeper

See:

- [Balance review](./docs/balance-review.md)
- [Economy design](./docs/economy-design.md)
- [Product vision](./docs/product-vision.md)
- [Requirements tracker](./docs/requirements-tracker.md)

## Contributing

Contributions are very welcome, especially around:

- real-save balancing feedback
- edge-case and migration testing
- UI clarity and onboarding
- alert tuning and signal-to-noise cleanup
- automated harness improvements

Start here:

- [Contributing guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)

## Development

<details>
<summary><strong>Requirements</strong></summary>

- Node.js `20+`
- npm
- OpenRCT2

</details>

<details>
<summary><strong>Main commands</strong></summary>

```powershell
npm install
npm run typecheck
npm run test
npm run build
npm run check
npm run install:plugin
```

</details>

<details>
<summary><strong>Balance and QA commands</strong></summary>

```powershell
npm run analyze:balance:quick
npm run analyze:balance:difficulty
npm run analyze:balance
npm run analyze:balance:lab
npm run analyze:balance:autotune
npm run analyze:balance:release
```

- `analyze:balance:quick`: fast everyday balance snapshot for iteration
- `analyze:balance`: reproducible baseline balance report
- `analyze:balance:lab`: parallel candidate search across major balancing knobs
- `analyze:balance:autotune`: runs the candidate search, saves the full report, and tells you whether the current live defaults should be replaced
- `analyze:balance:release`: controlled release soak with pragmatic defaults for production-style QA

Saved reports:

- `dist/balance-quick-latest.json`
- `dist/balance-autotune-latest.json`
- `dist/balance-release-latest.json`

The project now has a real automatic balance loop, but it is intentionally advisory rather than magical. It can search a wide parameter space and recommend stronger live defaults, but real-save QA still matters for final release judgment.

</details>

<details>
<summary><strong>Project structure</strong></summary>

```text
docs/
  balance-review.md
  economy-design.md
  github-release-template.md
  implementation-plan.md
  product-vision.md
  release-checklist.md
  requirements-tracker.md
scripts/
  analyze-balance-quick.mjs
  analyze-balance-release.mjs
  analyze-balance-lab.mjs
  analyze-balance.mjs
  balance-analysis.ts
  balance-lab-shared.ts
  balance-lab.ts
  balance-shared.ts
  build.mjs
  install-plugin.ps1
  release-package.mjs
src/
  config.ts
  index.ts
  types.ts
  domain/
  state/
  ui/
tests/
  *.test.ts
```

</details>

## Reporting issues

Please use the GitHub templates when possible:

- bug report
- feature request
- balance report

Balance reports are especially useful for this project because many of the most important issues only appear over longer saves.

## Open source readiness

This repository includes:

- MIT license
- changelog
- release checklist
- GitHub release template
- contributing guide
- code of conduct
- security policy
- issue templates
- pull request template
- CI workflow

## Roadmap

Near-term priorities:

- continue reducing top-end snowballing
- further tune long-term investment returns
- expand real-save QA coverage
- keep widening the automatic anti-dominance tuning space where the lab still finds sticky top-end behavior
- keep improving player guidance and readability

## Credits

Built for OpenRCT2 and inspired by the kind of industry-pressure storytelling that management games like Game Dev Tycoon do so well.
