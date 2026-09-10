# CSV import and export

Choose **Import CSV / TSV** and select a UTF-8 file. Check the separator, front/back/tag mapping, and whether the first row contains column names. The preview shows up to ten records, with long fields abbreviated. All records are validated during import. CSV files can be up to **200 MB (209,715,200 bytes)**, with at most **20,000 cards**, **100 columns**, and **200,000 characters per card side**. Preparation runs in the background and can be canceled. Once a database import/restore is committing, wait for it to finish.

Quoted commas, doubled quotation marks, multiline fields, Unicode, tabs, and common Anki headers are supported. Imports add cards rather than updating matching ones. Cloze cards are skipped with a report; custom templates, audio/video, and `.apkg` are unsupported.

For HTML image references such as `<img src="diagram.png">`, enable **Render safe HTML formatting** and choose the accompanying flat media folder. Image files must be supplied separately: **CSV does not embed images**. Missing files are reported.

**Export** saves a ZIP containing `cards.csv` and referenced media. Extract it before importing the CSV, then choose its media folder. For Anki, copy media into `collection.media` and import with HTML enabled.

## Copyable LLM prompt: generate a compatible CSV

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

For a complete saved library, see [Backups and storage](https://github.com/sethg9/super-card-flashcards/wiki/Backups-and-storage).
