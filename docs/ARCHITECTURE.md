# Architecture

Quiet Signal is a static, local-first PWA: React 19, TypeScript, Vite, Tailwind, Zustand and Dexie (IndexedDB). There is no backend; nothing leaves the browser. This document describes how the code is organised and how the important mechanisms work, so you can find your way around before changing something.

Contents: [Layers](#layers) · [Data flow](#data-flow) · [Data layer](#data-layer-dexie) · [Review algorithm](#review-algorithm) · [Security model](#security-model) · [PWA and service worker](#pwa-and-service-worker) · [i18n](#i18n) · [Testing](#testing) · [Known limitations](#known-limitations)

## Layers

```
pages  ->  components + hooks  ->  stores (Zustand)  ->  db / services
```

| Layer | Location | Responsibility |
| --- | --- | --- |
| Pages | `src/pages/` | Route targets. Kept thin: they wire hooks to components. Routes are declared in `src/App.tsx` (all but Today are lazy-loaded). |
| Components | `src/components/`, with `settings/`, `deck/`, `today/` subfolders | Presentational pieces and page sections (for example the settings sections, the clarify deck, the Today deck). |
| Hooks | `src/hooks/` | UI logic that used to live in pages, for example `useEncryptionSettings`, `usePinLock`, `useDailySession`, `useTodayActions`, `useInboxQueue`, `useClarifyDraft`, `useClarifyActions`, `useQuickCapture`. |
| Stores | `src/store/` | Zustand: `useQuoteStore`, `useBookStore`, `useSettingsStore`, `useToastStore`. Stores call the data layer and keep the in-memory list that pages render. |
| Data layer | `src/db/database.ts` | The only module that talks to the Dexie tables. Also owns encryption at rest (it calls `src/services/security.ts`). |
| Services | `src/services/` | Pure-ish logic: `review.ts` (spaced repetition), `security.ts` (PIN and vault), import/export (`importExport.ts`, `kindleImport.ts`, `readwiseCsvImport.ts`, `csv.ts`), `reflections.ts`, `backup.ts`, reminders. |
| Utils / types | `src/utils/`, `src/types/` | `src/utils/date.ts` provides `localDateKey` (local `YYYY-MM-DD`, not the UTC date). Types hold `Quote`, `Book` and small helpers such as `quoteStatus`. |

Rule of thumb: never touch `db.quotes` / `db.books` outside `src/db/database.ts`, otherwise rows bypass the encryption layer.

## Data flow

Capture, then clarify, then review:

1. **Capture.** Text, photo, voice, share-target and imports create entries through `useQuoteStore.addQuote` -> `createQuote`. Quick capture, the zero-capture sheet and the share target create entries with `status: 'inbox'` ("Rauschen" / noise), so there is one way in; the old `/add` route redirects to `/today?capture=text`, which opens the capture sheet. The status can be changed later on the detail page; `createQuote` itself defaults to `status: 'signal'` when no status is given. Imports go through `upsertQuotes`.
2. **Clarify.** The inbox page (`InboxPage`, built from `components/deck/` and the `useInbox*` / `useClarify*` hooks) shows inbox entries as a swipe deck. Per entry you can keep it as a signal, save details while it stays in the inbox, snooze it (`snoozedUntil` = next 06:00 local time), or let it rest (↓, `restPatch`; undo returns it to the inbox via `undoRestPatch(..., 'inbox')`). Swipes never delete: the explicit delete button sets `deletedAt` (soft delete into the trash, with undo); the trash page restores or empties it.
3. **Review.** The Today page (`useDailySession` + `selectDailyStack` in `src/services/review.ts`) builds the daily deck from *due* entries with `status === 'signal'` only; the stack is not padded, so it can be empty (then "Browse anyway" uses `selectBrowseStack`, which changes no schedule). Gestures map to pure patch builders in `src/services/lifecycle.ts` (`moreOftenPatch`, `lessOftenPatch`, `restPatch`, `wakePatch`), applied through `useQuoteStore` with the updater form of `updateQuote(id, (current) => patch)` so they act on the freshly read row. Dated thoughts live in `src/services/thoughts.ts` (`addThoughtPatch`, `adoptNotePatch`, ...).

Every persisted change goes store -> `src/db/database.ts` -> Dexie, and the store then reloads its list (`loadQuotes`). Entries without `status` are treated as `signal` (`quoteStatus`), which keeps old data working.

## Data layer (Dexie)

Database name `quiet-signal`, defined in `src/db/database.ts`. Each version lists only the indexed fields; other `Quote` / `Book` fields are stored but not indexed. Tags use a multi-entry index (`*tags`).

| Version | Tables and indexes |
| --- | --- |
| 1 | `quotes`: `id, author, source, favorite, createdAt, updatedAt, nextReviewAt, *tags` |
| 2 | adds `books`: `id, title, weight, createdAt, updatedAt` |
| 3 | `quotes` adds `status`, `signalStrength` |
| 4 | `quotes` adds `entryType` |
| 5 | `quotes` adds `snoozedUntil`, `deletedAt` |

Versions 3 to 5 only add indexes; there are no upgrade callbacks. Rows written by older versions simply lack the newer fields, and the read paths fill in defaults (`withQuoteDefaults`: `likes` 0, `status` `signal`, `people` `[]`). Imports of old backups apply the same defaults. Changing the schema means adding a new `version(n)` block, never editing an existing one.

Behaviour worth knowing:

- **Read paths skip undecryptable rows.** `listQuotes`, `listTrashed`, `getQuote`, `listBooks` and `getBook` decrypt each row separately; a row that fails (corrupt payload, wrong key) is skipped with a single `console.warn` instead of breaking the whole list. A locked vault reads as an empty list.
- **Writes fail when locked.** With encryption enabled but the key not in memory, `encryptQuoteForStorage` / `encryptBookForStorage` throw `Encryption is locked.`
- **Encrypt-all and decrypt-all are atomic.** `encryptAllQuotes` and `decryptAllQuotesAndDisable` load and transform every row first (all WebCrypto work happens before the transaction). If any row cannot be decrypted they abort with `Some entries could not be decrypted; aborting to avoid data loss.` The loaded rows are then rewritten by id (`bulkPut`, no table clear) inside a single `rw` transaction, so a failure leaves the old rows intact and rows created after loading are not lost. The encryption record is removed only after the plaintext rows are committed.
- **`updateQuote` is serialised per id.** Updates are read-modify-write with async WebCrypto in between, so they cannot run in one Dexie transaction. They are chained per quote id instead, which keeps concurrent patches (for example like + review) from overwriting each other. This only covers `updateQuote` and only a single tab; `upsertQuotes`, `deleteQuote` and the bulk rewrites bypass the queue.
- **`enableEncryption` refuses when already enabled** (`Encryption is already enabled.`), so a second call cannot replace the salt and strand existing rows.
- **Tags** are normalised (trimmed, lower-cased, de-duplicated, comma-split) on write.

Export/import format: `exportJson` writes `{ app: 'Quiet Signal', version: 1, exportedAt, books, quotes }`. Import sanitises IDs and media URLs. Old backups must stay importable, so do not change this envelope without a compatibility path.

## Review algorithm

Lifecycle in `src/services/lifecycle.ts`, stack selection in `src/services/review.ts`. A quote is `inbox` (noise), `signal` or `rest` (see README, "Noise, Signal, Rest").

### Intervals

Each signal carries its own `reviewIntervalDays` (optional field on the quote, no schema change). When it is missing, `effectiveInterval` derives it from `reviewCount`: `0 -> 1`, `1 -> 3`, `2 or more -> 7`. Intervals are in days and capped at 365.

| Action | New interval |
| --- | --- |
| New signal / wake | `1` |
| more often (swipe right) | `min(365, ceil(current * 1.5))`, also `likes + 1` |
| less often (swipe left) | `min(365, max(14, ceil(current * 4)))` |
| let rest (swipe down) | status becomes `rest`, interval is kept |

More-often and less-often also bump `reviewCount` and set `lastReviewedAt`. `nextReviewAt` is the local calendar day today plus the interval, at 06:00 local time (`reviewDateFromInterval`). Example: 1, 2, 3, 5, 8, 12, 18, 27 days on repeated "more often"; "less often" at 8 days gives 32.

### Daily stack

`selectDailyStack(quotes, { limit, date? })`:

1. **Candidates:** `status === 'signal'`, not deleted, not snoozed, not already reviewed today (local day key), and *due* (`!nextReviewAt` or `nextReviewAt <= now`). There is no backlog fill.
2. **Score** (higher first):
   - Review score: never reviewed = `1000` (+`80` if favorite); otherwise `daysSinceReview * 10` (+`60` if favorite) `- reviewCount`.
   - Like bonus: `min(likes, 8) * 35`.
   - `reviewScore + likeBonus`. Signal strength and book weight no longer influence the score.
   - Plus a seeded random term in `[0, 180)`.
3. **Author dedupe:** walking that order, an entry whose author (case-insensitive) is already in the stack is skipped, or there are no more candidates than `limit`. A second pass then fills any remaining slots from what was skipped.

`selectBrowseStack(quotes, { limit, seed })` shuffles all live signals regardless of due date and never writes.

### Seed

The random term comes from a small seeded PRNG (FNV-1a hash of the seed string, then a mulberry-style generator). The seed is `` `${localDateKey}:${limit}` ``: the same entries on the same local day produce the same stack, and a new local day reshuffles. The day key uses the local calendar date (`src/utils/date.ts`), not UTC. Tests run with `TZ=Europe/Berlin` to keep this deterministic.

## Security model

Be clear about what each mechanism does and does not protect.

### PIN lock: a view lock, not encryption

- `setPinLock` stores `{ salt, hash }` in `localStorage` (key `quiet-signal-pin`); the hash is PBKDF2-SHA-256 (180,000 iterations) of the PIN.
- `SecurityProvider` shows a lock screen until the PIN verifies. It hides the UI; it does **not** encrypt anything. Without the vault, entries sit unencrypted in IndexedDB and are readable through browser dev tools or the profile files.
- The PIN is short (the UI only requires a minimum of 4 characters), so it has few combinations. Anyone who can read `localStorage` can brute-force the stored hash offline. Treat the PIN as protection against someone glancing at an unlocked device, nothing more.

### Vault: AES-GCM encryption at rest

- When enabled, quotes and books are encrypted with **AES-GCM (256-bit)**. The key is derived from the password with **PBKDF2-SHA-256, 180,000 iterations**, and a random 16-byte salt.
- The `CryptoKey` is created non-extractable and kept **in memory only** (a module variable in `security.ts`). Locking, disabling or reloading the page drops it; the password is needed again.
- Every write uses a fresh random 12-byte IV, stored next to the ciphertext (`encryptionIv`). The serialised entry (all fields) is the encrypted payload (`encryptedPayload`).
- The salt, the verifier (`hash`) and the record version are stored in `localStorage` (key `quiet-signal-encryption`) so the password can be checked at unlock time.

**Verifier and record versions.** The password is run through PBKDF2-SHA-256 once. The resulting bits are imported as the non-extractable AES-GCM key, and the stored verifier is `SHA-256(context || bits)` with a fixed domain label. The record carries `version: 2`. A record without a version (earlier format) is accepted on a correct password; a record with any other version fails closed (unlock is refused and the record is left untouched).

**Key rotation for earlier-format vaults.** On a successful unlock of an earlier-format vault, `unlockVault` (`database.ts`) moves the vault to a fresh salt and key: every row (including trashed quotes and books) is re-encrypted in memory, the new version 2 record is first staged under `quiet-signal-encryption-pending`, the rows are written in one transaction, and only then the staged record becomes the active one and the in-memory key is switched. If anything fails before the rows are committed, the vault unlocks with its current key and the rotation is retried on the next unlock. If the active record cannot be saved after the commit, the staged record still describes the rows; the next unlock reads rows with either key and finishes the rotation. Version 2 vaults are not rotated again.

### Deprecated stored fields

`signalStrength`, `entryType`, `locationName`/`locationLatitude`/`locationLongitude` (on quotes) and `weight` (on books) are no longer written for new entries, shown, searched or evaluated. The type definitions keep them (marked `@deprecated`), existing rows and backups keep their values, and JSON import/export passes them through unchanged. The Dexie schema, including the indexes on `signalStrength`, `entryType` and `weight`, is unchanged.

### What stays unencrypted

An encrypted quote row keeps these fields in plaintext (see `encryptQuoteForStorage`): `id`, `createdAt`, `updatedAt`, `reviewCount`, plus the markers `encrypted`, `encryptedPayload` and `encryptionIv`. `text` is an empty string, `tags` is `[]`, `favorite` is `false` and `likes` is `0` as placeholders. All other fields (author, source, notes, media, status, scheduling dates and so on) are inside the payload, so the indexes on them are empty for encrypted rows.

An encrypted book row keeps `id`, `weight`, `createdAt`, `updatedAt` and the markers; `title` is an empty string.

Also unencrypted: app settings in `localStorage`, the language, the PIN and vault records described above, and the reminder configuration (in a Cache API entry shared with the service worker).

### Other notes

- Exports (JSON/CSV/Markdown) are plaintext files; the vault does not apply to them.
- If the vault is enabled but locked, reads return an empty list and writes throw `Encryption is locked.`
- Bulk rewrites (enable, disable, key rotation) hold a write lock in `database.ts`: single writes wait until the rewrite has finished, and the rewrite waits for writes already in progress (within one tab).
- There is no password recovery. A forgotten vault password means the encrypted entries are unreadable.

Please report security issues as described in [SECURITY.md](../SECURITY.md).

## PWA and service worker

- `vite-plugin-pwa` runs with `strategies: 'injectManifest'` and `registerType: 'autoUpdate'` (`vite.config.ts`). The service worker source is `src/sw.ts`; the plugin injects the precache manifest (`self.__WB_MANIFEST`) at build time. The web app manifest (name, icons, `start_url: /today`, shortcuts for text/photo/audio capture, and a GET `share_target` at `/share-target`) is also defined in `vite.config.ts`.
- The service worker precaches the build output and registers a navigation fallback to `/index.html`, so deep links work offline once installed. It calls `skipWaiting()` and `clientsClaim()`.
- **Reminders:** the SW handles `periodicsync` (best-effort, Chromium/installed PWA) and a test-notification message. The reminder config lives in a Cache API entry (`src/services/reminderShared.ts`) because the worker cannot read `localStorage`. A reminder fires on the first sync after the chosen local time on a day it has not fired yet.
- `src/sw.ts` is excluded from coverage and is not unit tested.

## i18n

- `src/i18n/translations.ts` combines one file per language: `src/i18n/locales/{de,en,es,fr}.ts`. The default language is `de`; the initial language comes from `localStorage`, then the browser language, then the default.
- Keys are typed from the English file, and `translations` is declared with `satisfies Record<LanguageCode, Record<string, string>>`; a missing key in any language is a type error, and `src/i18n/translations.test.ts` checks key parity.
- Components use `useI18n()` (`src/i18n/useI18n.ts`); `I18nProvider` only exports the provider.

## Testing

Vitest 5 with jsdom, Testing Library and `fake-indexeddb`; 40+ test files. `vitest.global-setup.ts` sets `TZ=Europe/Berlin` so date logic is deterministic, and `src/test/setup.ts` clears `localStorage` before each test. Helpers live in `src/test/` (`factories.ts`: `makeQuote`, `makeBook`, `readFixture`; `render.tsx`: `renderWithProviders`; `fixtures/`: synthetic Kindle, Readwise and backup files, described in `src/test/fixtures/README.md`). Some tests are *characterization tests* that pin current behaviour, including behaviour that looks questionable; those are marked in the test code. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the workflow.

## Known limitations

- **Corrupt encrypted entries cannot be recovered from the UI ([#15](https://github.com/ES-92/quiet-signal/issues/15)).** An entry that fails to decrypt is skipped (with a console warning) so the rest of the library loads, but the user is not told, cannot delete it, and turning encryption off aborts as long as such an entry exists.
- `updateQuote` serialisation works within one tab only; concurrent edits from two tabs can still overwrite each other.
- Data lives in one browser profile; there is no sync. Clearing site data deletes it, so use the export for backups.
