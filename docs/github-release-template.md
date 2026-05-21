# GitHub Release Template

## Suggested title

`v<version> - World Park League release`

## Suggested short description

World Park League turns OpenRCT2 into a living global park economy with rival rankings, market share, investments, prestige goals, rivalry challenges, spotlight boosts, watchlists, and endgame pressure.

Primary install asset:

- download the standalone `WorldParkLeague-v<version>.js`
- place it into `Documents/OpenRCT2/plugin`

## Suggested highlights

- `50`-park global league with daily movement and bigger event cycles
- Investments, mergers, exits, board pressure, equity and buybacks
- Prestige / achievement system with real rewards
- Watchlist, alerts, local rivals and head-to-head rivalry challenges
- Charts, yearly recap, progress filters and clearer player guidance
- Automated balance harness plus release-soak workflow

## Suggested release notes body

### What is in this release

- Rival parks compete in a persistent world economy instead of existing only as flavor text.
- Guests are pulled through people share, momentum, boosts, awards, and market conditions.
- Your park can invest in rivals, respond to board pressure, unlock prestige rewards, and fight head-to-head challenges with a primary rival.
- The UI now supports both a simpler onboarding view and deeper management / prestige / rivalry detail.

### QA status

- Typecheck, tests, build, package and plugin install verified
- automated balance analysis verified
- parallel balance-lab verified
- release-soak workflow verified

### Installation

Download `WorldParkLeague-v<version>.js` from this release and place it directly into `Documents/OpenRCT2/plugin`.
The ZIP is included as a secondary convenience bundle with docs and license files.

### Known follow-up areas

- long-hold investment ROI still needs observation on real saves
- top-end parks are stronger than ideal in synthetic long-run scenarios
- more real savegame QA is still recommended before calling balance final

## Suggested screenshot checklist

- Main window in `Simple` mode on a smaller park
- League board plus chart / progress area on a midgame save
- Prestige or Management view with rewards / actions / rivalry information
