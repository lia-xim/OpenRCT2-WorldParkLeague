# OpenRCT2 World Park League

[![CI](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/actions/workflows/ci.yml/badge.svg)](https://github.com/lia-xim/OpenRCT2-WorldParkLeague/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

World Park League is an OpenRCT2 plugin that adds a global competitor economy on top of the base game.

Instead of building in isolation, your park competes inside a living world of rival parks, shifting market share, prestige races, spotlight boosts, investments, mergers, board pressure, alerts, yearly recaps, and head-to-head rivalries.

## Why this exists

OpenRCT2 is fantastic at park-building, but long-running saves often lose pressure once your park is stable.

World Park League adds that missing meta-game:

- rival parks that matter
- people share instead of passive endless demand
- direct pressure from local and global competitors
- prestige goals and achievement rewards
- charts, recaps, watchlists, and actionable guidance
- stronger late-game tension without needing fully simulated rival maps

## Feature highlights

- `50`-park global league with daily movement and bigger event cycles
- local rivals and watchlists with signal-focused alerts
- people share, rankings, and guest-cap feedback into your real park
- investments, dividends, mergers, exits, and portfolio management
- governance, board pressure, equity offers, buybacks, and management actions
- yearly recap, prestige goals, achievement rewards, and lifetime records
- spotlight, featured, and buzz boost systems
- direct head-to-head rival challenges with rewards
- history charts, progress filters, and analyst-style explanations
- balancing harnesses and long-run release soak workflows

## Current status

This project is already playable and feature-rich.

The current focus is no longer "build the foundation", but:

- long-run balancing against snowballing
- real-save QA across early, midgame, and dominant endgame parks
- release polish and contributor friendliness

The biggest remaining risk is still balance, especially:

- top-1 and top-3 stickiness
- long-hold investment ROI
- how much boosts and prestige rewards help already-strong parks

## Installation

### Release build

Download the latest packaged plugin from the GitHub Releases page once releases are published, then place `WorldParkLeague.js` into your OpenRCT2 plugin folder:

`Documents/OpenRCT2/plugin`

### Local development build

```powershell
npm install
npm run install:plugin
```

That builds the plugin and copies it into your local OpenRCT2 plugin directory.

## Development

### Requirements

- Node.js 20+
- npm
- OpenRCT2

### Useful commands

```powershell
npm run typecheck
npm run test
npm run build
npm run check
npm run install:plugin
```

### Balance and QA workflows

```powershell
npm run analyze:balance
npm run analyze:balance:lab
npm run analyze:balance:release
```

What they do:

- `analyze:balance`: reproducible baseline report
- `analyze:balance:lab`: parallel candidate search across balancing knobs
- `analyze:balance:release`: longer parallel soak intended for release readiness

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

## Contributing

Contributions are welcome.

Good contribution areas right now:

- real-save balancing feedback
- UI clarity and onboarding improvements
- alert tuning and signal-to-noise cleanup
- more long-run tests and harness coverage
- bug fixes around migration, edge cases, or unusual park states

Start here:

- [Contributing guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)

## Reporting issues

Please use the GitHub issue templates when possible:

- bug report
- feature request
- balance report

Balance reports are especially useful for this project because a "bug" is often really a long-run tuning problem.

## Open source readiness

The repository includes:

- MIT license
- changelog
- release checklist
- GitHub release template
- contribution and conduct docs
- issue templates
- pull request template
- CI workflow

## Roadmap

Near-term priorities:

- reduce top-end dominance further
- keep long-term investments from snowballing too hard
- validate the current profile against more real save files
- continue polishing the player guidance layer

## Credits

Built for OpenRCT2 and inspired by the kind of rival-industry pressure that games like Game Dev Tycoon create so well.
