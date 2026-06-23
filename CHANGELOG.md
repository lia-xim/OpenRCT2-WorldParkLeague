# Changelog

## 0.25.0

- Added the first `Park Experience` layer so major league moments can become visible in the park, not only in the UI.
- Added player park events: `Press Day`, `School Trip`, `Influencer Event`, `Regional Fan Weekend`, and `VIP Critic Visit`.
- Added real guest waves for experience events, including themed guest names, guest items, and named VIP critic guests.
- Added a manual `People` window that lets players locate critics, press, creators, school leads, and fan-weekend captains without interrupting play.
- Added one-shot visual celebration triggers using OpenRCT2 entities such as balloons, money effects, and flare effects.
- Added VIP critic review resolution based on real park rating, ride satisfaction, average excitement, park depth, and operating profit.
- Added positive review rewards and negative review penalties that affect park cash and governance confidence.
- Added active park-event visibility in the main UI timeline and selected-park details.
- Added a dedicated `Tasks` window for active assignments, including progress, target, deadline, reward, risk, and clear automatic-check wording.
- Added a `Cheats` window and direct `World Park League Cheats` menu entry for cash, guests, park open/close attempts, visual bursts, forced league boosts, and manual league-month advancement.
- Hardened league-driven guest spawning so event and boost guests wait while the park is closed.
- Added `docs/outstanding-experience-card.md` as the long-running plan for deeper park-visible moments, seasonal expos, safer rival sabotage, and event balancing.
- Updated schema to `27`.

## 0.24.0

- Simplified player-facing window naming and reduced key management screens around `Money`, `Rivals`, `Goals`, and `Help`.
- Added an in-game Help window that explains rank, score, people share, park cash, active goals, rival challenges, and counterplay.
- Added new player-triggered countermeasures: `Counter Campaign`, `Local Push`, and `Build Focus`.
- Added construction-focused objectives for coaster quality and capacity expansion, with save migration defaults for older active goals.
- Added save-aware difficulty recommendations so the UI can explain whether Casual, Normal, Hard, or Tycoon fits the current park.
- Updated schema to `26`.

## 0.23.0

- Added a first-run quick-start window so new players immediately understand rank, goals, difficulty, money, rivals, and popups.
- Added persistent popup pacing so important warnings stay visible without repeatedly interrupting the player.
- Improved the simple park snapshot with a concrete weakest-score-driver explanation and next improvement target.
- Rewrote rival pressure campaign messaging so attacks read like visible competitor moves, not just hidden stat changes.
- Added `npm run analyze:balance:difficulty` to compare Casual, Normal, Hard, and Tycoon presets across the same QA scenarios.
- Updated migration state to schema `25` for persisted UI/onboarding status.

## 0.22.0

- Added difficulty presets (`Casual`, `Normal`, `Hard`, `Tycoon`) that scale objective frequency, penalties, rival pressure, investment shocks, and catch-up intensity.
- Added active player objectives with real deadlines, park-cash rewards, park-cash penalties, board/investor consequences, and short momentum rewards.
- Added more downside risk to rival investments through negative paper-value shock events, so holdings are no longer mostly upward-drifting.
- Added visible warning popups and a compact challenge timeline for rival attacks, failed objectives, investment shocks, and other important pressure events.
- Simplified the main player UI with clearer top-level numbers, renamed shortcut buttons (`Money`, `Rivals`, `Goals`), and moved deeper analysis into advanced/detail views.
- Added one-time save calibration for older/high-score saves so strong existing parks do not instantly trivialize the league when the plugin state is created or migrated.
- Kept the player-facing release UI free of debug controls while preserving internal debug hooks for development builds and local testing.

## 0.21.0

- Introduced the first production `Owner Finance` layer with dedicated owner cash, board salary, owner net worth, and save migration support.
- Moved rival investing onto the owner side so buy/sell trades, dividends, rivalry rewards, and prestige cash payouts now route through one consistent portfolio model.
- Clarified the in-game UI around park cash vs owner cash, renamed the portfolio area, and exposed owner salary / owner cashflow context in the main window.
- Updated prestige tracking so finance-oriented goals now read from owner-side liquidity rather than the park treasury.

## 0.20.2

- Switched the plugin away from hardcoded dollar UI strings toward the OpenRCT2 money formatter, so the in-game currency follows the player's actual game settings more closely.
- Added and updated planning docs for the next `Owner Finance` / single-investment-system architecture.
- Continued polishing public-facing docs and release prep for the current release branch.

## 0.20.1

- Added a standalone release-ready plugin asset so end users can download a single `.js` file and drop it straight into `Documents/OpenRCT2/plugin`.
- Improved the public README and release documentation for a cleaner open-source installation and contribution flow.
- Removed visible debug controls from the shipped in-game UI so the release build reflects the actual player-facing design.

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
