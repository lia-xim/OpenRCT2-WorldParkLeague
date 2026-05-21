# Contributing to OpenRCT2 World Park League

Thanks for considering a contribution.

This project mixes game design, simulation logic, UI, and long-run balance work, so even small feedback can be valuable.

## Best ways to help

- report bugs with clear reproduction steps
- report balance problems from real save files
- improve onboarding, UI clarity, and wording
- add tests around edge cases and save migrations
- refine alerts, rivalry pacing, and prestige rewards

## Before you start

1. Read the current [README](./README.md)
2. Check the [requirements tracker](./docs/requirements-tracker.md)
3. Look at the latest [balance review](./docs/balance-review.md)

## Development setup

```powershell
npm install
npm run check
```

For local OpenRCT2 testing:

```powershell
npm run install:plugin
```

## Project standards

- keep domain logic separate from OpenRCT2 integration where possible
- prefer small, testable functions
- add or update tests when changing simulation, migrations, or balancing hooks
- avoid breaking existing save data without a migration path
- prefer clear, plain naming over cleverness

## Pull requests

Please keep pull requests focused.

A good PR usually includes:

- what changed
- why it changed
- what was tested
- any balancing or save compatibility risks

If your change affects balance, include at least one of:

- `npm run analyze:balance`
- `npm run analyze:balance:lab`
- real-save observations

## Balance feedback

Balance feedback is especially useful when you include:

- park phase: early / mid / dominant endgame
- what happened
- what felt wrong
- what you expected instead
- save file or screenshots if possible

## Questions

If you are unsure whether something should be a bug report, feature request, or balance report, open the one that is closest and explain the uncertainty. That is completely fine.
