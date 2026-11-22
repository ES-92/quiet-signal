# Contributing to Quiet Signal

Thanks for your interest! Issues, ideas, and pull requests are all welcome. For larger changes, please open an issue or a discussion first so we can agree on direction.

## Development

```bash
npm install
npm run dev        # Vite dev server on http://127.0.0.1:5173
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check (`tsc`) and build (`vite build`) |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run coverage` | Run the tests with a V8 coverage report |

**`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` must pass** for any change (lint fails on warnings), and please verify your change in the running app. CI runs exactly these four on every pull request and on `main`; CI must be green before merging.

## Tests

We work test-first: **no production code without a failing test first.** Write the test, watch it fail for the right reason, then make it pass. For a bug fix, start with a test that reproduces the bug.

- Stack: Vitest, jsdom, Testing Library, `fake-indexeddb`. Test files sit next to the code (`*.test.ts` / `*.test.tsx`).
- Structure each test as Arrange, Act, Assert (with `// Arrange`, `// Act`, `// Assert` comments).
- Test names (`describe` / `it` strings) are written in German; code, comments and all non-test files are in English.
- Tests must be deterministic and offline. The time zone is pinned to `Europe/Berlin` (`vitest.global-setup.ts`); control the clock with `vi.useFakeTimers()` / `vi.setSystemTime()`.
- Helpers live in `src/test/`: `makeQuote` / `makeBook` / `readFixture` (`factories.ts`) and `renderWithProviders` (`render.tsx`, wraps i18n and router).
- **Fixtures are synthetic.** Never commit real notes, highlights or backups. Put sample files in `src/test/fixtures/`, build them from the format the code expects, mark them as synthetic, and list them in `src/test/fixtures/README.md`.
- Characterization tests that pin behaviour you suspect is wrong should say so in a comment; fix the behaviour in a separate change.

## Releasing

The "What's new" sheet and the update notice depend on the version number, so every release bumps it. Maintainer routine:

1. Bump the version without tagging: `npm version minor --no-git-tag-version` (or `patch`). This updates `package.json` and `package-lock.json`; `APP_VERSION` follows from it.
2. Add the release notes for the new version at the top of `releaseNotes` in `src/services/release.ts` (short, user-facing, 5–6 items at most) and their keys in **all four** locales (`src/i18n/locales/`). A test fails if the newest notes are older than the app version.
3. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` and add a fresh, empty `## [Unreleased]` above it.
4. Make sure lint, typecheck, tests and build pass, then merge to `main`.
5. Tag the merge commit `vX.Y.Z` and create the GitHub release from that tag (maintainer only).

Open installs notice the new version themselves: the service worker takes over in the background and the app shows "Neue Version da · Neu laden". After reloading, users see the release notes once.

## Reporting bugs

Open an issue and give it the label `bug`, with steps to reproduce. A fixing PR should reference it (`Fixes #123`).

## Pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`).
- Add a line to [`CHANGELOG.md`](CHANGELOG.md) under `## [Unreleased]` (Added / Changed / Fixed / Removed) for every PR.
- Keep PRs focused and make sure CI is green.

## Conventions

- Style: **no semicolons, single quotes, 2-space indent**, functional components with **named exports** (Prettier + ESLint enforce this).
- **All persistence goes through `src/db/database.ts`** (the encryption layer lives there) — don't touch the Dexie tables directly.
- **UI text goes through i18n** (`src/i18n/translations.ts`, with one file per language in `src/i18n/locales/`) and must exist in **all four** languages (`de`, `en`, `es`, `fr`), or type checking (and so the build) fails. English + German are first-class; Spanish/French fall back to English.
- Keep components focused; comments explain *why*, not *what*.
- Commits: short, imperative, Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`).

## Architecture at a glance

- **Local-first, no backend.** All data lives in the browser via IndexedDB (Dexie); settings in `localStorage`.
- **All persistence goes through `src/db/database.ts`** — the optional encryption layer lives there. Don't touch the Dexie tables directly.
- **State:** Zustand stores in `src/store/`. **UI:** thin pages in `src/pages/`, sections and components in `src/components/`, UI logic in `src/hooks/`.
- **Daily resurfacing / spaced repetition:** `src/services/review.ts`.
- **PWA:** custom service worker in `src/sw.ts`, registered and watched for updates in `src/services/appUpdate.ts`; manifest in `vite.config.ts`.
- **i18n:** `src/i18n/translations.ts` and `src/i18n/locales/` (de/en/es/fr — keys must exist in all four).

The details (layers, data model, review algorithm, security model) are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
