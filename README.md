# OpenRCT2 World Park League

[![CI](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/actions/workflows/ci.yml/badge.svg)](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/lia-xim/OpenRCT2-WorldParkLeague)](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/releases)

World Park League is an OpenRCT2 plugin that turns a single-park save into a living global park economy.

Instead of growing in isolation, your park competes inside a wider industry with rival parks, shifting people share, prestige races, investments, mergers, spotlight boosts, local rivalries, head-to-head challenges, yearly recaps, and management pressure.

## What it adds to OpenRCT2

OpenRCT2 already gives you a great park-building sandbox.  
World Park League adds the missing meta-game around it:

- a `50`-park global field that moves every day
- local rivals you directly fight for people share
- visible momentum, prestige, rivalry, and ranking pressure
- boosts, awards, and buzz moments that can swing attention toward your park
- investments, equity, governance, and long-run management decisions
- charts, alerts, yearly recaps, and clearer guidance on what matters next

The goal is simple: make long-running saves stay interesting much longer.

## Core features

### Global league

- `50` simulated parks
- daily ranking movement with larger event cycles
- regional market profiles and world mood shifts
- mergers, bankruptcies, recoveries, scandals, and expansion arcs

### Player-facing competition

- real player score built from live park data
- people share and guest-cap pressure tied back into the real save
- local rival cluster and watchlist alerts
- direct head-to-head rival challenges
- spotlight, featured, and buzz systems

### Management layer

- investments in other parks
- dividends, exits, merger carry-over, and portfolio tracking
- equity offers and buybacks
- board pressure, governance programs, and management actions

### Progression layer

- yearly recap
- prestige goals
- achievement rewards
- lifetime records
- progress charts and comparison views

## Why it feels different

World Park League is not just a utility overlay.

It is designed to make the game feel like you are part of a real park industry:

- if you climb, the world reacts
- if you dominate, pressure increases
- if you stagnate, rivals pass you
- if you hit a hot streak, the spotlight can flood your park with attention

It is meant to create story, not just numbers.

## Installation

### From releases

1. Go to the [Releases page](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/releases)
2. Download the latest `WorldParkLeague.js` release package
3. Place the plugin file into:

```text
Documents/OpenRCT2/plugin
```

4. Start OpenRCT2
5. Open the plugin through the in-game plugin menu

### Local development install

```powershell
npm install
npm run install:plugin
```

This builds the plugin and copies it into your local OpenRCT2 plugin directory.

## In-game overview

The main window is built around two modes:

- `Simple`: better for normal play and first-time use
- `Advanced`: better for deeper management and analysis

The release UI intentionally avoids developer-only debug controls. The visible interface is the actual player-facing design.

## Compatibility

- OpenRCT2 scripting plugin
- developed and tested with modern OpenRCT2 builds
- built with Node.js `20+`

If something behaves differently on a specific OpenRCT2 version, please open an issue and mention the exact build.

## Development

### Requirements

- Node.js `20+`
- npm
- OpenRCT2

### Main commands

```powershell
npm run typecheck
npm run test
npm run build
npm run check
npm run install:plugin
```

### Balance and QA commands

```powershell
npm run analyze:balance
npm run analyze:balance:lab
npm run analyze:balance:release
```

What they do:

- `analyze:balance`: reproducible baseline balance report
- `analyze:balance:lab`: parallel candidate search across major balancing knobs
- `analyze:balance:release`: longer multi-worker release soak for production-style QA

## Project structure

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

## Documentation

- [Balance review](./docs/balance-review.md)
- [Economy design](./docs/economy-design.md)
- [Implementation plan](./docs/implementation-plan.md)
- [Product vision](./docs/product-vision.md)
- [Requirements tracker](./docs/requirements-tracker.md)
- [Release checklist](./docs/release-checklist.md)

## Current release state

The project is already feature-rich and publicly releasable, but the biggest remaining long-run work is still balance.

Main follow-up areas:

- top-1 and top-3 stickiness
- long-hold investment ROI
- real-save validation across early, midgame, and dominant endgame parks
- continued UI and onboarding polish

That means the architecture and systems are strong, but balancing is still actively being refined.

## Contributing

Contributions are very welcome.

Useful areas right now:

- real-save balancing feedback
- migration and edge-case testing
- UI clarity and onboarding improvements
- alert tuning and signal-to-noise cleanup
- additional automated harness coverage

Start here:

- [Contributing guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)

## Reporting issues

Please use the GitHub issue templates when possible:

- bug report
- feature request
- balance report

Balance reports are especially valuable for this project, because many important problems only show up over longer saves.

## Open source readiness

The repository includes:

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

- keep reducing top-end snowballing
- further tune long-term investment returns
- expand real-save QA coverage
- keep improving player guidance and readability

## Credits

Built for OpenRCT2 and heavily inspired by the kind of industry-pressure storytelling that games like Game Dev Tycoon create so well.
