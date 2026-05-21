# Changelog

## 0.20.0

- Added direct head-to-head rival challenges with real cash, boost, and temporary reward-program payouts.
- Expanded prestige into a real reward layer with previews, next-unlock guidance, free stakes, cash rewards, and temporary buffs.
- Hardened watchlist alerts with cooldown filtering to reduce repeated noise.
- Extended the balance lab to search investment and prestige reward multipliers, not just spotlight and ladder knobs.
- Added a dedicated `analyze:balance:release` soak workflow for long parallel release QA.
- Applied the strongest current balance wave to runtime defaults and wired it into save migrations.
- Added migration and regression coverage for rivalry challenge state and alert cooldown behavior.

## 0.18.0

- Applied the first automated balancing wave from the new Balance Lab.
- Added a parallel `analyze:balance:lab` workflow for large candidate sweeps.
- Moved spotlight balancing into runtime config and save migrations.
- Improved release readiness with packaging, checksum generation, and release documentation.
- Stabilized the project around daily live pulses, rivalry, prestige, watchlists, recap flows, and production-oriented QA.
