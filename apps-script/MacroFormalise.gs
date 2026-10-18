/**
 * Macroscopic Formaliser — Apps Script ↔ Google Gemini bridge
 *
 * SETUP (one-time):
 * 1. Get an API key: https://aistudio.google.com/apikey
 * 2. https://script.google.com → New project → name it "Macro Formalise"
 * 3. Replace Code.gs contents with this file
 * 4. Project Settings (gear) → Script properties → Add:
 *      GEMINI_API_KEY = <your key from AI Studio>
 *      MODEL          = gemini-3.5-flash-lite   (optional; default below)
 *      SYSTEM_PROMPT  = <custom text>           (optional override)
 * 5. Deploy → New deployment → Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Copy the /exec URL into MACRO_FORMALISE_URL in macro.html on GitHub Pages
 * 7. Commit/push macro.html so Pages picks up the URL
 *
 * CORS note (GitHub Pages → Apps Script):
 * Browsers cannot use Content-Type: application/json (preflight fails).
 * The page POSTs text/plain;charset=utf-8 with a JSON body — same pattern as
 * TEMPLATE_SYNC in this repo. doPost also accepts form field "payload".
 *
 * Models: https://ai.google.dev/gemini-api/docs/models
 * Change MODEL in Script Properties anytime (no page edit needed).
 * Free-tier-friendly defaults: gemini-3.5-flash-lite or gemini-3.8-flash.
 * (gemini-2.0-flash is shut down; gemini-2.5-flash is legacy-restricted.)
 */

var DEFAULT_MODEL = 'gemini-3.5-flash-lite';
var GEMINI_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models/';

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
        error: 'GEMINI_API_KEY not set in Script Properties'
      });
    }

    var model = getModel_();
    var systemPrompt = getSystemPrompt_();
    var result = callGemini_(apiKey, model, systemPrompt, raw);
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
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
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

function callGemini_(apiKey, model, systemPrompt, raw) {
  var url =
    GEMINI_BASE +
    encodeURIComponent(model) +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  var payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: raw }]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  };

  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var text = resp.getContentText();
  var data;
  try {
    data = JSON.parse(text);
  } catch (_e) {
    return { ok: false, error: 'Gemini returned non-JSON (HTTP ' + code + ')' };
  }

  if (code < 200 || code >= 300) {
    var msg =
      (data && data.error && (data.error.message || data.error.status)) ||
      ('Gemini HTTP ' + code);
    return { ok: false, error: String(msg) };
  }

  var parts =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts;
  if (!parts || !parts.length) {
    var block =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].finishReason;
    return {
      ok: false,
      error: block
        ? 'Empty model response (finishReason: ' + block + ')'
        : 'Empty model response'
    };
  }

  var out = [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i] && parts[i].text) out.push(parts[i].text);
  }
  var joined = out.join('').trim();
  if (!joined) {
    return { ok: false, error: 'Empty model response' };
  }
  return { ok: true, text: joined };
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
