# Changelog

All notable changes to Quiet Signal are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the project uses [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Testinfrastruktur (Vitest, jsdom, Testing Library, fake-indexeddb) mit `npm test`, `npm run test:watch` und `npm run coverage`; erste Tests für den CSV-Parser.
- Test fixture library (`makeQuote`, `makeBook`, `readFixture`, synthetic Kindle fixtures) and characterization tests for the Kindle clippings import.
- Synthetic Readwise CSV fixtures and characterization tests for the Readwise CSV import (header aliases, tag splitting, book merging, duplicate skipping, invalid dates).
- Synthetic backup fixtures (current, legacy, malicious) and characterization tests for the JSON/CSV/Markdown import and export, including media-URL and ID sanitizing.
- Characterization tests for the PIN lock and vault encryption (PIN verify/clear, AES-GCM roundtrip for quotes and books, unique IVs, locked/unlock behavior).
- Characterization tests for the database layer against fake-indexeddb (defaults, normalization, trash, legacy v1 schema upgrade, encryption roundtrip and locked behavior, corrupt-row and double-enable data-safety cases).
- Characterization tests for the spaced-repetition review algorithm (interval table, `applyReview`, daily stack selection and determinism), including a pinned UTC-vs-local-day behavior around midnight.
- Characterization tests for reflections, book merge suggestions, backup state, release notes and quote search/filtering, including pinned UTC-vs-local date quirks.
- GitHub Actions CI workflow (lint, typecheck, tests, build on push to `main` and on pull requests) and a CI status badge in the README.
- `docs/ARCHITECTURE.md` (layers, data flow, Dexie versions 1–5, review algorithm, security model, known limitations), updated `CONTRIBUTING.md` (test-first rule, test commands, fixtures convention, changelog and bug-label rules) and a "Development & tests" section in the README.
- Dependabot configuration for npm and GitHub Actions with weekly, grouped minor/patch updates.

### Changed
- Moved build-only packages `vite-plugin-pwa` and `@vitejs/plugin-react` from `dependencies` to `devDependencies`.
- Split the translations file into one file per language under `src/i18n/locales/`; public exports are unchanged, and a missing key in any language now fails type checking. Added tests for key parity across languages.
- Resolved the React-hooks lint warnings in the shell components (AppShell, CommandDrawer, ConfirmSheet, InstallPrompt, Onboarding, WhatsNew, ZeroCaptureSheet) and the pages (BookDetailPage, InboxPage, TodayPage, TrashPage), each covered by new component tests and without visible behavior change apart from the quick-capture draft fix listed under Fixed; `useI18n` now lives in `src/i18n/useI18n.ts` (the `I18nProvider` module only exports the provider). `npm run lint` now fails on warnings (`--max-warnings 0`). The quote store exposes a `loadedAt` timestamp so the inbox can hide snoozed entries without reading the clock while rendering.
- Split `SettingsPage` (683 lines) into one component per settings section under `src/components/settings/` and focused hooks (`useEncryptionSettings`, `usePinLock`, `useReminderSettings`, `useShortcutCopy`, `useBackupStatus`, `useSecurityStatus`, `useClearAllData`); the page is now about 100 lines. No visible behavior change; covered by new page and hook tests.
- Split `InboxPage` (465 lines) into deck components under `src/components/deck/` (`ClarifyDeckStack`, `ClarifyActionBar`, `ClarifyDetailsForm`, `InboxCaptureForm`) and hooks (`useInboxQueue`, `useClarifyDraft`, `useClarifyActions`, `useQuickCapture`); the page is now about 140 lines. No visible behavior change; covered by new page and hook tests.
- Split `TodayPage` (470 lines) into components under `src/components/today/` (`TodayHeader`, `TodayDeckStack`, `TodayTopCard`, `TodayContextMenu`, `TodayBookEditor`) and hooks (`useDailySession`, `useTodayActions`); the page is now about 110 lines. No visible behavior change; covered by extended page tests and new hook tests.

### Fixed
- Undo after discarding a daily card now brings the card back to the deck at its previous position (#18).
- Quick-capture sheet no longer discards the draft when the app re-renders while it is open.
- CSV export now quotes fields containing a carriage return (`\r`), so they survive a CSV export/import roundtrip instead of splitting into extra rows (#13).
- Import no longer produces `NaN` for non-numeric `reviewCount`/`audioDurationMs` (now 0/unset), and empty or `null` location coordinates are no longer turned into `0`; an explicit `0` is kept (#12).
- Book duplicate detection now treats `ß` as `ss`, so "Der Prozess" and "Der Prozeß" are suggested as duplicates (#11).
- Daily review now uses the local calendar day instead of the UTC date (#2): an entry read the previous evening no longer counts as read today after local midnight, and the daily stack seed changes at local midnight (so the stack order shifts once for users between 00:00 and the UTC offset).
- Backup file names now use the local date instead of the UTC date (#8).
- Reflection Markdown now prints local dates; a week starting Monday 00:00 local time prints that Monday instead of the Sunday before (#9).
- Weekly reflection range now ends on Sunday 23:59:59.999 local time even in weeks with a daylight-saving change (#10).
- One undecryptable encrypted row no longer makes the whole library unreadable (#3): it is skipped with a console warning while all other quotes and books load; encrypt-all/decrypt-all now abort instead of silently dropping such rows.
- Enabling encryption twice no longer overwrites the salt and key (which made all encrypted rows unreadable); `enableEncryption` now rejects with "Encryption is already enabled." and leaves the vault untouched (#4).
- Enabling or disabling encryption no longer deletes quotes in the trash; they stay in the trash and can still be restored (#14).
- Enabling/disabling encryption is now atomic (rows are only rewritten inside one transaction, and the encryption record is removed only after the rewrite committed), refuses to run on a locked vault, and Settings shows an error toast instead of failing silently (refs #3, #14).
- Kindle import now handles Windows line endings (CRLF): clippings parsed from a CRLF file are identical to those from an LF file, including the added date (#5).
- Kindle import now reads German "Hinzugefügt am" dates (e.g. "Montag, 3. März 2025 10:15:00") as local time, so clippings from German Kindles keep their added date (#6).
- Kindle import now keeps only the longer highlight when a later clipping extends an earlier, shorter one of the same book (previously both were imported when the shorter one came first) (#7).
- Keeping a daily card no longer loses the like: concurrent updates to the same quote (like and review) are now serialized per quote, so neither overwrites the other's fields (#16).
- Discarding a daily card (swipe down or "delete noise") no longer skips the next card; the following card now takes its place and the discarded card disappears at once instead of snapping back until saving finishes (#17).

### Security
- Hardened how the vault password check is stored; existing vaults are upgraded automatically on the next unlock.
- Ran `npm audit fix` (no breaking changes): `npm audit --omit=dev` now reports 0 vulnerabilities (previously 17, incl. 8 high, e.g. in `vite`, `react-router`, `source-map-js`).

## [0.2.0] - 2026-05-28

### Added
- **Unified gesture grammar** across both swipe decks (Heute & Klären): → keep, ← snooze (until next morning), ↓ discard, ↑ details — built on a shared `useSwipeDeck` hook.
- **Trash** with soft-delete: discarding moves entries to a trash you can restore from or empty manually, with an immediate **undo toast**.
- **Real snooze**: deferred entries reappear the next morning instead of just being skipped.
- **Onboarding & discoverability**: a one-time in-context gesture coachmark on the first card and a re-accessible **Gestures** reference page.
- **Support & "What's New"**: a quiet support sheet (Ko-fi + PayPal) reachable from a header heart on every page except the daily deck, and a version-gated "What's New" card shown once per update.

### Changed
- New tagline ("Ruhig sammeln. Klar behalten."), a refreshed "signal ping" wordmark and PWA icons, consistent vocabulary, and corrected German diacritics throughout.
- Added an ESLint + Prettier setup with `lint` / `format` / `typecheck` scripts; extracted the deck sub-components into focused files.
- Renamed internal persistence identifiers from `commonplace` to `quiet-signal`.

### Removed
- The "Quiet Signal Plus" premium framing — the app is and stays fully free; there is no paid tier.

## [0.1.0]

- Initial local-first PWA: capture (text/photo/voice), daily spaced-repetition review, books, reflections, Kindle/Readwise import, JSON/CSV/Markdown export, optional PIN lock and AES-GCM encryption, German/English/Spanish/French.
