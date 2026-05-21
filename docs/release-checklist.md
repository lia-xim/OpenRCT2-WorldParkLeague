# Release Checklist

## Local release prep

1. Run `npm run check`
2. Run `npm run analyze:balance`
3. Run `npm run analyze:balance:lab`
4. Run `npm run analyze:balance:release`
5. Run `npm run release:package`

## Verify the release artifact

Check the generated files in `release/`:

- `WorldParkLeague-v<version>.zip`
- `WorldParkLeague-v<version>.zip.sha256`
- staging folder `WorldParkLeague-v<version>/`

The ZIP should contain:

- `WorldParkLeague.js`
- `README.md`
- `CHANGELOG.md`
- `LICENSE`

## GitHub publication

This workspace currently has no configured Git remote and no direct repository-creation flow.

Manual steps:

1. Create a new public GitHub repository.
2. Add the remote locally:
   `git remote add origin <your-repo-url>`
3. Push the branch:
   `git push -u origin main`
4. Create a GitHub release tagged `v<version>`.
5. Upload:
   - `release/WorldParkLeague-v<version>.zip`
   - `release/WorldParkLeague-v<version>.zip.sha256`
6. Use the prepared release text in `docs/github-release-template.md`.
7. Add at least three screenshots:
   - small / early park view
   - midgame league board / chart / alerts
   - prestige or capital desk / rivalry view

## Post-release smoke test

1. Install the packaged `WorldParkLeague.js` in OpenRCT2.
2. Open a small park, a midgame park, and a dominant endgame save.
3. Verify:
   - main window opens cleanly
   - balance boosts still feel visible
   - rankings and charts stay stable
   - capital desk actions still work
   - prestige rewards and rival challenges trigger and settle cleanly
   - watchlist alerts stay useful instead of spammy
   - no save migration regressions appear
