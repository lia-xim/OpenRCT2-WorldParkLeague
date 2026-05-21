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
- prestige, yearly recaps, achievements, and long-term progression
- a management layer with investments, buybacks, governance, and rewards
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
| Player pressure | People share, guest-cap pressure, score races, local rivals, spotlight and buzz swings |
| Management layer | Investments, portfolio tracking, exits, buybacks, governance pressure, management actions |
| Progression | Prestige goals, achievement rewards, yearly recap, records, trend charts, progress filters |
| Rival storytelling | primary rivals, watchlist alerts, head-to-head challenges, analyst guidance, league headlines |

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
- rivalry tracking in both the main UI and prestige flows
- alerts when a rival surges, weakens, or becomes vulnerable

### Management and economy

- invest in other parks and track portfolio performance
- receive dividends and handle merger carry-over or forced exits
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

The shipped release UI is the real player-facing design.  
Visible debug controls are intentionally removed from the public release experience.

## Current release status

The plugin is feature-rich, installable, and publicly releasable today.

The main remaining refinement area is long-run balance, especially:

- top-end snowballing
- long-hold investment ROI
- extended real-save validation across small, midgame, and dominant parks

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
npm run analyze:balance
npm run analyze:balance:lab
npm run analyze:balance:release
```

- `analyze:balance`: reproducible baseline balance report
- `analyze:balance:lab`: parallel candidate search across major balancing knobs
- `analyze:balance:release`: longer multi-worker release soak for production-style QA

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
- keep improving player guidance and readability

## Credits

Built for OpenRCT2 and inspired by the kind of industry-pressure storytelling that management games like Game Dev Tycoon do so well.
