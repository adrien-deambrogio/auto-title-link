# Paste URL Title

Paste a URL in Obsidian and it becomes `[Page title](url)` automatically.

- Desktop only.
- A `[Fetching title…](url)` placeholder appears instantly and is replaced when the title arrives.
- Full page title is kept (no suffix cleanup). `|`, `[`, `]` and `\` in titles are escaped.
- If the title can't be fetched (10 s timeout, HTTP error, non-HTML, no title), the domain name is used.
- Not converted when text is selected or the cursor is in a code block / inline code.

## Install (manual)

```bash
npm install
npm run build
```

Copy `main.js` and `manifest.json` into `<your vault>/.obsidian/plugins/paste-url-title/`, then enable the plugin in *Settings → Community plugins*.

## Develop

`npm run dev` rebuilds on change; `npm test` runs the unit tests.
