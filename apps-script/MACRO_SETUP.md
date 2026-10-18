# Macroscopic Formaliser — setup

Turns raw cut-up dictation into formal macroscopic report text via **xAI Grok**, called from **Google Apps Script**. The UI lives on GitHub Pages (`macro.html`).

## 1. xAI API key

1. Open [https://console.x.ai/](https://console.x.ai/) and create an API key.
2. Confirm billing works for your account (Hong Kong / region as applicable).

## 2. Apps Script project

1. Open [https://script.google.com/](https://script.google.com/) → **New project**.
2. Name it e.g. `Macro Formalise`.
3. Paste the contents of [`MacroFormalise.gs`](./MacroFormalise.gs) into `Code.gs` (replace the stub).
4. **Project Settings** (gear) → **Script properties** → **Add script property**:

| Property       | Value                                      |
|----------------|--------------------------------------------|
| `XAI_API_KEY`  | your xAI key (required)                    |
| `MODEL`        | `grok-4.7` (optional; default in script)   |
| `SYSTEM_PROMPT`| optional override of the built-in prompt   |

5. **Deploy** → **New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorise when prompted. Copy the web app URL ending in `/exec`.

Smoke-test: open the `/exec` URL in a browser. You should see JSON like  
`{"ok":true,"service":"macro-formalise","model":"grok-4.7","hasKey":true}`.

## 3. Wire the GitHub Pages UI

In [`../macro.html`](../macro.html), set:

```js
const MACRO_FORMALISE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
```

Commit and push so [https://ericfumc.github.io/reporting/macro.html](https://ericfumc.github.io/reporting/macro.html) updates.

## 4. Use

1. Open the macro page.
2. Paste the clerk’s raw macroscopic transcription.
3. Click **Formalise**.
4. Review the output (edit if needed) → **Copy**.

## CORS / how the browser talks to Apps Script

Apps Script web apps do not handle JSON preflight well. This tool uses the same workaround as the report **TEMPLATE_SYNC** bridge:

- Browser `POST`s with `Content-Type: text/plain;charset=utf-8` and a JSON body `{ "raw": "..." }`.
- Apps Script `doPost` parses `e.postData.contents`.
- Deploy must be **Anyone**; Execute as **Me**.

If Formalise fails with a network/CORS error after you set the URL, re-deploy the web app (New version) and confirm the `/exec` GET health check works.

## Changing the model

Set Script property `MODEL` to any chat model id from [xAI models docs](https://docs.x.ai/developers/models) (e.g. `grok-4.7`, `grok-4.6`). No need to edit `macro.html`.

## Privacy

Specimen text is sent to xAI via Google’s servers (UrlFetchApp). Follow hospital policy for PHI / identifiable data; strip patient identifiers if required.
