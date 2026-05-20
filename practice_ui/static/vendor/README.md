# Editor dependency

The v1 practice UI loads Monaco Editor from the public CDN at:

`https://cdn.jsdelivr.net/npm/monaco-editor@0.49.0/min/vs`

If that script cannot load, `practice_ui/static/app.js` automatically falls back to
a plain `<textarea>` editor using the same save and run APIs.
