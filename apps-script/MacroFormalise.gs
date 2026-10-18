/**
 * Macroscopic Formaliser — Apps Script ↔ xAI Grok bridge
 *
 * SETUP (one-time):
 * 1. https://script.google.com → New project → name it "Macro Formalise"
 * 2. Replace Code.gs contents with this file
 * 3. Project Settings (gear) → Script properties → Add:
 *      XAI_API_KEY  = <your key from https://console.x.ai/>
 *      MODEL        = grok-4.7          (optional; default below)
 *      SYSTEM_PROMPT = <custom text>   (optional; overrides DEFAULT_SYSTEM_PROMPT)
 * 4. Deploy → New deployment → Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Copy the /exec URL into MACRO_FORMALISE_URL in macro.html on GitHub Pages
 * 6. Commit/push macro.html so Pages picks up the URL
 *
 * CORS note (GitHub Pages → Apps Script):
 * Browsers cannot use Content-Type: application/json (preflight fails).
 * The page POSTs text/plain;charset=utf-8 with a JSON body — same pattern as
 * TEMPLATE_SYNC in this repo. doPost also accepts form field "payload".
 *
 * Get an API key: https://console.x.ai/
 * Models docs:   https://docs.x.ai/developers/models
 */

var DEFAULT_MODEL = 'grok-4.7';
var XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';

var DEFAULT_SYSTEM_PROMPT =
  'You are a pathologist writing the macroscopic (gross) section of a surgical ' +
  'pathology report. Convert the raw cut-up dictation / clerk transcription into ' +
  'formal report English.\n\n' +
  'Rules:\n' +
  '- Keep every measurement, colour, margin, ink colour, orientation landmark, ' +
  '  specimen type, laterality, and count exactly as stated.\n' +
  '- Do not invent findings, diagnoses, or details that are not in the input.\n' +
  '- Use British spelling (colour, tumour, centre, analysed).\n' +
  '- Write clear prose suitable for the macroscopic description section.\n' +
  '- Output only the formal macroscopic text — no title, no preamble, no commentary.';

function doGet(e) {
  return jsonOut({
    ok: true,
    service: 'macro-formalise',
    model: getModel_(),
    hasKey: !!getApiKey_()
  });
}

function doPost(e) {
  try {
    var body = parseBody_(e);
    var raw = (body && body.raw != null) ? String(body.raw).trim() : '';
    if (!raw) {
      return jsonOut({ ok: false, error: 'raw text required' });
    }
    if (raw.length > 100000) {
      return jsonOut({ ok: false, error: 'raw text too long (max 100000 characters)' });
    }

    var apiKey = getApiKey_();
    if (!apiKey) {
      return jsonOut({
        ok: false,
        error: 'XAI_API_KEY not set in Script Properties'
      });
    }

    var model = getModel_();
    var systemPrompt = getSystemPrompt_();
    var result = callGrok_(apiKey, model, systemPrompt, raw);
    if (!result.ok) {
      return jsonOut({ ok: false, error: result.error });
    }
    return jsonOut({ ok: true, text: result.text, model: model });
  } catch (err) {
    return jsonOut({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

/** Parse JSON body (text/plain or application/json) or form field "payload". */
function parseBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    var contents = e.postData.contents;
    try {
      return JSON.parse(contents);
    } catch (_ignore) {
      // fall through to form params
    }
  }
  if (e.parameter) {
    if (e.parameter.payload) {
      return JSON.parse(e.parameter.payload);
    }
    if (e.parameter.raw != null) {
      return { raw: e.parameter.raw };
    }
  }
  return {};
}

function getApiKey_() {
  return PropertiesService.getScriptProperties().getProperty('XAI_API_KEY') || '';
}

function getModel_() {
  return (
    PropertiesService.getScriptProperties().getProperty('MODEL') ||
    DEFAULT_MODEL
  );
}

function getSystemPrompt_() {
  return (
    PropertiesService.getScriptProperties().getProperty('SYSTEM_PROMPT') ||
    DEFAULT_SYSTEM_PROMPT
  );
}

function callGrok_(apiKey, model, systemPrompt, raw) {
  var payload = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: raw }
    ],
    temperature: 0.2
  };

  var resp = UrlFetchApp.fetch(XAI_CHAT_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();
  var data;
  try {
    data = JSON.parse(text);
  } catch (_e) {
    return { ok: false, error: 'xAI returned non-JSON (HTTP ' + code + ')' };
  }

  if (code < 200 || code >= 300) {
    var msg =
      (data && data.error && (data.error.message || data.error)) ||
      ('xAI HTTP ' + code);
    return { ok: false, error: String(msg) };
  }

  var choice =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;
  if (!choice || !String(choice).trim()) {
    return { ok: false, error: 'Empty model response' };
  }
  return { ok: true, text: String(choice).trim() };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
