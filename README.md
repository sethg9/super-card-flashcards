# Super Card Flashcards

Study at your own pace with an offline Windows flashcard app. Create simple question-and-answer cards, write math, add images, and organize your learning into decks—without daily limits or due dates.

**[Download SuperCard for Windows → Releases](https://github.com/sethg9/super-card-flashcards/releases/latest)**

This repository is private. Downloads are available only to people signed into GitHub with repository access.

- Unlimited study, search, shuffle, and optional animated flips.
- Offline MathJax and images on both sides of a card.
- Light, accent-tinted Dark, and pure-black OLED themes.
- Custom accents and background images, saved locally.
- CSV/TSV import, CSV with media export, and library backups.

## Choose a download

| Download | Best for | How to launch |
| --- | --- | --- |
| `SuperCard-Setup-0.3.0-x64.exe` | Normal installation and shortcuts | Run the installer, follow the wizard, then open SuperCard from Start. |
| `SuperCard-Portable-0.3.0-x64.exe` | Running without an installation wizard | Save it somewhere convenient and double-click it. Initial extraction can take a moment. |

Both downloads are for Windows x64. Both store cards, settings, and copied images in **`%APPDATA%\SuperCard`** on the current computer. **The portable executable does not carry your library with it.** Use a library backup to move cards between computers. Both versions use the same library when launched normally on the same account.

These builds are **unsigned**. Windows may show an unknown-publisher or SmartScreen warning. For a download you trust from this repository, **More info → Run anyway** may be available; managed-device policy may prevent running it. Installation options may trigger an elevation prompt. No signing certificate is included.

## Start studying

1. Create a deck and give it a name.
2. Select **Add card**, enter the question and answer, and use the previews to check them. Click **Save card**; completed edits also autosave.
3. Choose **Study deck**, or use a card's play button to start from that card. Flip, navigate, shuffle, or restart whenever you want.
4. Open **Appearance** in the sidebar to choose a theme, accent, background image, or flip animation. Animations default on when no choice is saved; Windows reduced motion suppresses rotation.

Close and reopen SuperCard to continue where your saved library left off. Back up valuable decks before large imports or changing computers.

## Math and images

Use literal MathJax delimiters: `\(x^2+1\)` for inline math and `\[\frac{1}{2}\]` for display math. MathJax and its required resources are bundled, so math works without a connection.

Add card images through file selection, drag-and-drop, or clipboard paste. SuperCard copies them into managed storage. Background images are selected separately in **Appearance**; replace/remove them there and adjust dimming to keep content readable. Removing a background restores the theme, including pure black in OLED mode.

PNG, JPEG, GIF, and WebP files are supported, up to **200 MB (209,715,200 bytes)** per file and **40 megapixels**. SVG is unsupported. Invalid or missing images are rejected or displayed with a fallback. Large files can take longer to process.

## Import, export, and back up

Choose **Import CSV / TSV** and select a UTF-8 file. Check the separator, front/back/tag mapping, and whether the first row contains column names. The preview shows up to ten records, with long fields abbreviated. All records are validated during import. CSV files can be up to **200 MB (209,715,200 bytes)**, with at most **20,000 cards**, **100 columns**, and **200,000 characters per card side**. Preparation runs in the background and can be canceled. Once a database import/restore is committing, wait for it to finish.

Quoted commas, doubled quotation marks, multiline fields, Unicode, tabs, and common Anki headers are supported. Imports add cards rather than updating matching ones. Cloze cards are skipped with a report; custom templates, audio/video, and `.apkg` are unsupported.

For HTML image references such as `<img src="diagram.png">`, enable **Render safe HTML formatting** and choose the accompanying flat media folder. Image files must be supplied separately: **CSV does not embed images**. Missing files are reported.

**Export** saves a ZIP containing `cards.csv` and referenced media. Extract it before importing the CSV, then choose its media folder. For Anki, copy media into `collection.media` and import with HTML enabled.

**Back up library** saves a `.supercard` archive. **Restore backup** adds saved decks and images without overwriting existing decks. Backups exclude appearance settings, appearance-only backgrounds, and unsaved drafts. Archives are limited to 256 MiB compressed/expanded and 30,000 entries; backup card metadata is limited to 40,000,000 bytes to bound JSON parsing and restoration memory. Split large libraries into smaller exports if needed.

### Copyable LLM prompt: generate a compatible CSV

Replace the two placeholders below, then paste the entire prompt into your LLM. Check the generated facts before importing.

```text
Create exactly [DESIRED CARD COUNT] focused, accurate question/answer flashcards from this topic or source material:
[TOPIC OR SOURCE MATERIAL]

Return only UTF-8 CSV text, with no commentary and no Markdown fences.
Use comma delimiters and exactly three columns, in this order: Front,Back,Tags.
Start with these exact three lines:
#separator:Comma
#html:false
Front,Back,Tags

The third line is the column-name header, not a card. Do not add another header or Anki #columns line.
Each subsequent record must have three fields: one focused question, a clear answer, and optional space-separated tags (use an empty quoted field if none).
Quote every data field with double quotes. Escape any double quote inside a field by doubling it. Keep commas and any multiline text inside the quoted field. Use actual newlines, not literal backslash-n sequences.
Use plain text rather than HTML. For math use \(...\) inline or \[...\] for display. Preserve each literal backslash exactly once; this is CSV, not a JSON string. Do not use dollar-sign math delimiters.
Prefer short cards testing one idea. Do not invent unsupported facts; omit uncertain claims. Do not use cloze syntax or custom templates.
Do not embed or invent images. CSV contains text only. Image references require real, separately supplied image files and an HTML-enabled import, so omit images from this plain-text CSV.
```

This synthetic example can be saved as a UTF-8 `.csv` file and imported directly:

```csv
#separator:Comma
#html:false
Front,Back,Tags
"What is the capital of France?","Paris","geography"
"What does ""hello, world"" contain?","A comma and two words.","text"
"What is \(2^3\)?","\[2^3=8\]","math"
```

## Keyboard controls

| Key | While studying |
| --- | --- |
| Click the card, Space, Up, or Down | Flip the current card |
| Left / Right | Previous / next card |
| Enter on the focused card | Flip |
| Page Up / Page Down in the card content | Scroll a long card |
| Escape | Return to the deck |

Study shortcuts leave typing, editable fields, dropdowns, other controls, and open dialogs alone. Holding a key does not repeatedly flip. The **About & storage** guide also lists the controls and your data location.

## Development

Requires Node.js 24+ and npm. Run `npm ci`, then `npm run dev`. Use `npm test`, `npm run test:e2e`, and `npm run format:check` for checks. `npm run build` creates production assets; `npm run dist` creates the Windows installer and portable executable in `release/` without publishing. Run builds sequentially. `node scripts/packaged-smoke.cjs` tests an isolated packaged profile; `SUPERCARD_SMOKE_EXE` selects another executable. `SUPERCARD_TEST_DATA` accepts an absolute isolated data directory for tests; leave it unset for the normal library.

Built with Electron, React, TypeScript, SQLite, and MathJax. Personal data and generated binaries belong outside source history. See [TESTING.md](TESTING.md) for verification details.
