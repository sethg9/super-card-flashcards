# Verification

Tests use synthetic cards, generated image bytes, and isolated profiles under `.test-output/`. Personal sample files and the normal app data directory are not used by tests.

## Automated checks

Latest verification: 14 unit tests and all 5 Electron desktop tests passed. The TypeScript/production build passed. Light and OLED screenshots were reviewed; hardware-specific animation smoothness remains a manual check.

- `npm test`: SQLite persistence/rollback, CSV/TSV round trips, Unicode and multiline fields, headers and unsupported-feature reporting, media validation, portable restoration, unsafe archive rejection, sanitization, preference migration, additive settings storage, and accent contrast across Light/Dark/OLED with extreme and representative colors.
- `npm run test:e2e`: real Electron workflows for create/save/study/restart; immediate-close saving; synthetic CSV previews; offline math; image selection/drop/Windows clipboard paste; search and transfers; theme/accent controls; managed background persistence/removal; invalid images; long math cards; repeated flips; navigation resets; hidden-face isolation; reduced motion; preference restoration after restart.
- `npm run build` and `npm run format:check`: TypeScript, production assets, and formatting.
- `npm run dist`: unsigned x64 NSIS and portable builds, with publishing disabled. `node scripts/packaged-smoke.cjs` creates a fresh isolated profile, launches the packaged executable with networking disabled, saves a synthetic math/image card and appearance settings, studies both faces, verifies bundled resources, and reopens it to check persistence. It never opens the normal library. Set `SUPERCARD_SMOKE_EXE` to test another packaged executable.

Run builds sequentially. Native file picker selections use deterministic paths in desktop tests; filesystem writes, validation, image decoding, rendering, clipboard paste, and SQLite are real. Screenshots are saved locally for visual review and are not committed.

## Remaining manual checks

1. Exercise actual Windows file/color pickers, installer wizard, shortcuts, and uninstall/reinstall. Signing and installer distribution are separate tasks.
2. Try large real-world photos, Explorer drag-and-drop, and screenshots from different clipboard producers. Confirm backgrounds survive moving originals and disappear after removal.
3. Check high-DPI/multiple-monitor layouts, physical OLED output, screen-reader behavior, and animation smoothness on different GPUs. Automated CSS/DOM checks do not replace hardware/accessibility checks.
4. Import exported CSV/media into Anki itself and restore a backup on another Windows computer. Anki is not driven by these tests.

Deck backups include saved study content and its images. Appearance-only backgrounds/preferences are local settings outside the deck backup format.
