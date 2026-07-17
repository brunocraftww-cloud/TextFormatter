# Text Formatter — Local Tool

A 100% offline tool for applying formatting/substitution rules to text, with an editable rules panel.

## Files

```
app/
├── index.html     → open this file to use the tool
├── style.css      → interface appearance (Bootstrap-style dark theme)
├── app.js         → interface logic (rules table, editor, copy, import/export)
├── engine.js      → rule-application engine (independent from the UI)
├── rules.json     → default rules, editable outside the app
└── README.md      → this file
```

## How to use

### Option 1 — simplest (works on any computer)
Double-click `index.html`. It opens in your default browser and works without internet access.

> Note: when opened this way (the `file://` protocol), the browser won't let the page automatically load `rules.json` for security reasons. That's not a problem: the app already ships with the same rules **embedded** in the code (`engine.js`) and uses them automatically. To edit rules from outside the app, use the **"Import .json"** and **"Export .json"** buttons inside the interface.

### Option 2 — with automatic rules.json loading (optional)
If you'd like the app to read `rules.json` straight from disk on load (no manual import needed), run a simple local server from inside the `app/` folder:

```bash
# Python (already installed on most systems)
cd app
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. This is still 100% local/offline — the server only serves files from your own machine, with no external connection.

## Using the interface

The app opens on the **Editor** tab by default — that's where you paste and copy text. The **Rules** tab holds the substitution rules table.

### Editor tab
1. Paste the original text into the left panel (**Original text**). The right panel (**Formatted text**) updates automatically as you type or paste.
2. Use **Copy** to copy the result, or **Download .txt** to save it as a file.
3. Click **"Load example"** to try the tool with the text used to validate it.

### Rules tab
Each row has:
- **Group**: rule category (Heading/Structure, Character, Word, Special). Click it to change it — it's a dropdown, so new rules don't have to stay filed under "Word".
- **Find**: the original text/character.
- **Replace with**: the target text.
- **On**: checkbox to toggle the rule without deleting it.
- **✕**: removes the rule.

Hover over a row to see a short explanation of what it does and why (tooltip).

- Edit any **Find** or **Replace with** field directly in the table — the box grows automatically to fit the text inside it.
- **Reorder rules** by dragging a row using its ⠿ handle and dropping it above or below another row, or by clicking the ▲ / ▼ buttons — no need to open the JSON file and edit it by hand. This is the easiest way to move a new rule up to, say, 2nd or 3rd place if it needs to run before others.
- Click **"Re-apply"** to reprocess the text immediately with the updated rules.
- Click **"+ New rule"** to add a rule, fill in "Find" and "Replace with", then click "Re-apply". No code editing needed.
- Click **"Reset to defaults"** to undo everything and go back to the rules identified in the original analysis.

### Saving rules
- Every edit is auto-saved in the browser (localStorage), so your rules are still there next time you open the app.
- To keep an actual file copy of your rules, click **"Export .json"** — this downloads an updated `rules.json`.
- To load a previously saved rules file, click **"Import .json"**.
- In **Google Chrome or Microsoft Edge**, two extra buttons appear: **"Open local file"** and **"Save to file"**. These connect the app directly to a `rules.json` file on your computer — every change is saved to it automatically, no manual download/import needed.

## Adding new rules in the future
Use the **"+ New rule"** button in the Rules tab — no code changes required.

If you prefer editing `rules.json` directly in a text editor, the format is:

```json
{
  "version": 1,
  "rules": [
    {
      "id": "unique-id",
      "grupo": "Word",
      "descricao": "Explanation of the rule (shown as a tooltip)",
      "type": "text",
      "find": "text to find",
      "replace": "replacement text",
      "enabled": true
    }
  ]
}
```

- `"type": "text"` → literal substitution (does not interpret regex special characters; works with any text, including line breaks `\n`).
- `"type": "regex"` → regular expression (only used by the paragraph-break structural rule). Only use this type if you're comfortable with regex — for everyday rules, `"text"` is simpler and safer.

⚠️ **Rule order matters.** The engine applies rules top to bottom. Rules that depend on finding "raw" characters (like `£` or `%` inside a specific heading) must come *before* the generic rules that convert those same characters everywhere in the text. Avoid moving heading rules below the character rules.
