# Changelog

All notable changes to Quiet Signal are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the project uses [SemVer](https://semver.org/).

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
