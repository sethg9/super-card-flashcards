# Backups and storage

## Where your library lives

Both installed and portable SuperCard store data in **`%APPDATA%\SuperCard`** on the current Windows account. Paste that path into File Explorer's address bar to locate it. Saved cards and settings live in `supercard.sqlite`; copied card and background images are in `media/`.

The portable executable runs without an installation wizard, but **it does not carry your library with it**. Both versions use the same local library when launched normally on the same account. Copying only the portable `.exe` to another computer does not copy your cards.

## Back up and restore

**Back up library** saves a `.supercard` archive. **Restore backup** adds saved decks and images without overwriting existing decks. Backups exclude appearance settings, appearance-only backgrounds, and unsaved drafts. Archives are limited to 256 MiB compressed/expanded and 30,000 entries; backup card metadata is limited to 40,000,000 bytes to bound JSON parsing and restoration memory. Split large libraries into smaller exports if needed.

To move saved cards to another computer:

1. Use **Back up library** on the original computer.
2. Copy the resulting `.supercard` file to the other computer.
3. Open SuperCard there, choose **Restore backup**, review the preview, and confirm.
4. Check your restored decks and images. Choose appearance preferences again on that computer if needed.

Restoring adds decks rather than replacing existing ones, so repeated restores can create additional copies. Back up valuable decks before large imports. Keep backups in a separate location from the working library.

For individual decks and Anki transfers, use [CSV export with media](https://github.com/sethg9/super-card-flashcards/wiki/CSV-import-and-export).
