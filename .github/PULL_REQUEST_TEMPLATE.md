## What & why

Briefly describe the change and the motivation. Link any related issue (`Closes #…`).

## Checklist

- [ ] `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass
- [ ] Verified the change in the running app (`npm run dev`)
- [ ] New/changed UI text added to **all four** language blocks in `src/i18n/translations.ts`
- [ ] Persistence changes go through `src/db/database.ts` (not the Dexie tables directly)
- [ ] No new tracking, accounts, or cloud dependencies (the app stays local-first)

## Notes for reviewers
