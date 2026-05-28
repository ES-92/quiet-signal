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

There is no automated test suite yet; **`npm run build` and `npm run lint` must pass** for any change, and please verify your change in the running app.

## Conventions

- Style: **no semicolons, single quotes, 2-space indent**, functional components with **named exports** (Prettier + ESLint enforce this).
- **All persistence goes through `src/db/database.ts`** (the encryption layer lives there) — don't touch the Dexie tables directly.
- **UI text goes through i18n** (`src/i18n/translations.ts`) and must exist in **all four** language blocks (`de`, `en`, `es`, `fr`), or the build fails. English + German are first-class; Spanish/French fall back to English.
- Keep components focused; comments explain *why*, not *what*.
- Commits: short, imperative, ideally prefixed (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

## Architecture at a glance

- **Local-first, no backend.** All data lives in the browser via IndexedDB (Dexie); settings in `localStorage`.
- **All persistence goes through `src/db/database.ts`** — the optional encryption layer lives there. Don't touch the Dexie tables directly.
- **State:** Zustand stores in `src/store/`. **UI:** pages in `src/pages/`, shared components in `src/components/`.
- **Daily resurfacing / spaced repetition:** `src/services/review.ts`.
- **PWA:** custom service worker in `src/sw.ts`; manifest in `vite.config.ts`.
- **i18n:** `src/i18n/translations.ts` (de/en/es/fr — keys must exist in all four).

By contributing, you agree that your contributions are licensed under the project's [MIT License](LICENSE).
