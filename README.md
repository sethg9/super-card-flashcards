# SuperCard

An offline Windows flashcard app built with Electron, React, TypeScript, SQLite, and bundled MathJax. Study any card whenever you want: no accounts, schedules, daily limits, or required spaced repetition.

## Development

Install Node.js 24+ and npm, then:

```powershell
npm ci
npm run dev         # React hot reload + Electron
npm start           # production build and launch
npm run build       # TypeScript checks and production build
npm test            # storage, CSV, media, security, appearance tests
npm run test:e2e     # real Electron desktop workflows
npm run format:check
npm run dist        # unsigned Windows installer and portable executable
node scripts/packaged-smoke.cjs # offline packaged launch/reopen in an isolated profile
```

If npm is missing from PowerShell's PATH, reopen the terminal after installing Node.js or add its installation directory to the current session's PATH. Run build, test:e2e, and dist sequentially because they share build directories. Executables are generated in `release/`. Publishing is disabled in the packaging command; installer distribution is separate from source publication.

## Architecture and local data

- `electron/`: trusted main process, transactional SQLite storage, validated media, native dialogs, import/export, and named IPC handlers.
- `electron/preload.ts`: narrow isolated bridge. React never receives general filesystem, shell, or IPC access.
- `shared/`: data contracts, CSV parsing, preference migration, and derived accent colors.
- `src/`: React UI, sanitized content, offline MathJax, appearance controls, and CSS card rotation.
- `tests/`: synthetic fixtures and isolated profiles. Tests never read personal decks or sample CSVs.

Data lives outside the source tree in `%APPDATA%\SuperCard`: `supercard.sqlite`, its journal, and `media/`. Existing databases gain an additive settings table; decks and cards are not rewritten. Images, including backgrounds, are copied into content-addressed managed storage. Updates and uninstall preserve the data directory.

Version 0.2.0 produces `release/SuperCard-Setup-0.2.0-x64.exe` and `release/SuperCard-Portable-0.2.0-x64.exe`. Builds are unsigned unless signing is configured separately. Windows may display an unknown-publisher or SmartScreen warning. Packaged smoke tests set `SUPERCARD_TEST_DATA` to a fresh absolute directory under `.test-output/`; the same main-process-only environment override can isolate manual testing. Leave it unset for your normal library.

Production uses `supercard://app`, context isolation, sandboxing, a restrictive CSP, IPC sender checks, and blocked navigation/popups/external requests. Card HTML is sanitized. MathJax and dynamic SVG font data are bundled locally. Production Electron fuses disable Node environment/inspection switches and require the packaged ASAR.

## Appearance

Open **Appearance** in the sidebar:

- **Light**, **Dark**, or **OLED Black**. OLED uses pure `#000000` for the main background, cards, sidebar, and dialogs, with subtle borders.
- Default green branding uses **#78f542**. Choose an accent with the color picker, hue slider, or six-digit hex input. The preview updates live. **Reset to default** resets the accent. Filled buttons choose black or white labels automatically; text accents and focus colors are derived for contrast. Error and warning colors remain separate.
- Choose or replace a **background image**, adjust dimming, or remove it. Images use centered cover scaling without stretching. Opaque cards and panels keep content readable. Removing or losing an image restores the selected theme background. PNG, JPEG, GIF, and WebP are supported, up to 20 MB and 40 megapixels. SVG and corrupt images are rejected.
- **Animate card flips** enables a restrained 300 ms 3D rotation. It defaults off, including for existing users. The hidden face is inert and excluded from assistive technology. Navigation resets to the front; long cards scroll. Reduced motion disables rotation even when the toggle is on.

Preferences save locally and restore after restart. Existing explicit light/dark choices are migrated. The former fixed purple default becomes green. Packaged icons use default green independently of the chosen accent.

## Cards and transfers

Create decks, rename or delete them, search fronts/backs/tags, and edit both sides with live previews. Completed cards save automatically after a pause, on **Save card**, and before closing. Incomplete drafts remain recoverable by reopening the same editor. Use `\(...\)` for inline math and `\[...\]` for display math. Select, drop, or paste images into either side.

Study a full deck or start from any card's play button. Click/Space flips, Left/Right navigates, Escape returns, Shuffle changes session order, and Restart begins that order again. Focus a long card's scroll region and use Page Up/Down to read it.

CSV/TSV import provides preview, separator selection, front/back/tag mapping, and media-folder selection. Quoted commas, multiline fields, Unicode, common Anki headers, and raw math source are supported. Exports package CSV and referenced media in a ZIP. For Anki, extract it, copy media into `collection.media`, and import the CSV with HTML enabled.

Versioned `.supercard` backups contain saved decks/cards and their referenced images, with integrity validation. Restore adds decks without overwriting existing ones and assigns fresh IDs. Preferences, appearance-only backgrounds, drafts, and original timestamps are not part of deck backups. Unreferenced media is retained locally to protect drafts.

## Scope and limits

Basic front/back cards only. Cloze rows are reported and skipped; custom templates, audio/video, `.apkg`, GUID synchronization, and per-row deck routing are unsupported. Imports append cards. Accounts, cloud sync, AI, and spaced repetition are outside scope.

CSV imports are limited to 20 MB, 20,000 rows, 100 columns, and 200,000 characters per side. Archives are limited to 256 MB compressed or expanded. Large transfers can briefly pause the UI. The portable executable also uses `%APPDATA%\SuperCard`; use backups when moving collections.

See [TESTING.md](TESTING.md) for verification and manual checks. Personal data, generated builds, dependencies, and uploaded images are excluded from source publication.
