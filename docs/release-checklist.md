# Release Checklist

## Local release prep

1. Run `npm run check`
2. Run `npm run analyze:balance`
3. Run `npm run analyze:balance:lab`
4. Run `npm run analyze:balance:release`
5. Run `npm run release:package`

## Verify the release artifact

Check the generated files in `release/`:

- `WorldParkLeague-v<version>.js`
- `WorldParkLeague-v<version>.js.sha256`
- `WorldParkLeague-v<version>.zip`
- `WorldParkLeague-v<version>.zip.sha256`
- staging folder `WorldParkLeague-v<version>/`

Primary end-user asset:

- `WorldParkLeague-v<version>.js`

The ZIP should contain the same plugin file plus documentation:

- `WorldParkLeague.js`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`

## GitHub publication

1. Push the current branch to GitHub.
2. Create a GitHub release tagged `v<version>`.
3. Upload:
   - `release/WorldParkLeague-v<version>.js`
   - `release/WorldParkLeague-v<version>.js.sha256`
   - `release/WorldParkLeague-v<version>.zip`
   - `release/WorldParkLeague-v<version>.zip.sha256`
4. Mark the standalone `.js` file as the primary install download in the release body.
5. Use the prepared release text in `docs/github-release-template.md`.
6. Add at least three screenshots:
   - small / early park view
   - midgame league board / chart / alerts
   - prestige or capital desk / rivalry view

## Post-release smoke test

1. Install the released standalone `.js` file in OpenRCT2.
2. Open a small park, a midgame park, and a dominant endgame save.
3. Verify:
   - main window opens cleanly
   - balance boosts still feel visible
   - rankings and charts stay stable
   - capital desk actions still work
   - prestige rewards and rival challenges trigger and settle cleanly
   - watchlist alerts stay useful instead of spammy
   - no save migration regressions appear
