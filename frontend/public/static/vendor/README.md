# Editor dependency

The v1 practice UI loads Monaco Editor from the public CDN at:

`https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs`

Optional Vim keybindings use [monaco-vim](https://www.npmjs.com/package/monaco-vim) from:

`https://cdn.jsdelivr.net/npm/monaco-vim@0.4.4/dist/monaco-vim.umd.js`

If Monaco cannot load, `frontend/public/static/app.js` automatically falls back to
a plain `<textarea>` editor using the same save and run APIs. Vim mode is unavailable
in that fallback; the sidebar toggle stays disabled.
