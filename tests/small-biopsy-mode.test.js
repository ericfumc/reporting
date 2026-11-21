"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.resolve(__dirname, "..");
const indexPath = path.join(root, "index2.html");
const PUBLISHED_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRIMyFywb76pgt3-m-p97o6y-Qul9HWgxX7V_0W7nvgCc1z5ogWejCUGRj0SlFzER9Gtk3DTJcqSiPv/pub?output=csv";

let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("ok  " + name);
  } catch (err) {
    failed++;
    console.error("FAIL  " + name);
    console.error("  " + (err && err.stack ? err.stack : err));
  }
}

function extractFunction(src, name) {
  const re = new RegExp("function\\s+" + name + "\\s*\\(");
  const m = re.exec(src);
  if (!m) throw new Error("missing function " + name);
  const startBrace = src.indexOf("{", m.index);
  if (startBrace < 0) throw new Error("no body for " + name);
  let depth = 0;
  for (let i = startBrace; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return src.slice(m.index, i + 1);
    }
  }
  throw new Error("unclosed function " + name);
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("HTTP " + res.statusCode + " for " + url));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      })
      .on("error", reject);
  });
}

const src = fs.readFileSync(indexPath, "utf8");

test("index2.html has a third mode switch: Report | Block key | Small biopsy", () => {
  assert.match(src, /id="modeFormatBtn"[^>]*>Report</);
  assert.match(src, /id="modeBlockBtn"[^>]*>Block key</);
  assert.match(src, /id="modeBiopsyBtn"[^>]*>Small biopsy</);
  assert.match(src, /id="biopsyPane"/);
  assert.match(src, /js\/gastric-biopsy-report\.js/);
  assert.match(src, /body\.mode-biopsy/);
});

test("Small biopsy mode is not wired into the category dropdown", () => {
  assert.match(src, /id="categorySelect"/);
  assert.match(src, /id="templateSelect"/);
  // Builder lives in its own pane, not as a template option.
  assert.match(src, /id="biopsyGroups"/);
  assert.doesNotMatch(src, /categorySelect[^;]{0,200}biopsy/i);
});

test("Report mode template-loading path and sheet URL are unchanged", () => {
  const csvMatch = src.match(/id="csvUrl"[^>]*value="([^"]+)"/);
  assert.ok(csvMatch, "csvUrl input missing");
  assert.strictEqual(csvMatch[1], PUBLISHED_CSV);
  assert.match(src, /id="loadCsv"/);
  assert.match(src, /id="categorySelect"/);
  assert.match(src, /id="templateSelect"/);
  assert.match(src, /function parseCSV\s*\(/);
  assert.match(src, /function parseRowsFromCSV\s*\(/);
  assert.match(src, /function buildCategories\s*\(/);
  assert.match(src, /function fetchAndLoadCSV\s*\(/);
  assert.match(src, /function populateCategorySelect\s*\(/);
  assert.match(src, /function populateTemplateSelectForCategory\s*\(/);
  assert.match(src, /DOMContentLoaded[\s\S]*fetchAndLoadCSV\(url\)/);
});

test("index2.html does not delete or hide the original small-biopsy templates", () => {
  assert.doesNotMatch(src, /SMALL BIOPSY TEMPLATE[\s\S]{0,80}(delete|remove|hide)/i);
  assert.doesNotMatch(
    src,
    /if\s*\([^)]*(Gastritis|SMALL BIOPSY|small biopsy)[^)]*\)\s*(continue|return)/i
  );
});

test("live Small biopsy UI is graded IM/HP, benign-only, and has no dysplasia/malignancy controls", () => {
  assert.match(src, /id="biopsyGroups"/);
  assert.doesNotMatch(src, /biopsyMalignancyExtra|biopsyMalignancyText|malignancy-extra/);
  assert.doesNotMatch(src, /dysplasia:\s*['"]none['"]/);
  assert.match(src, /im:\s*'mild'/);
  assert.match(src, /helicobacter:\s*'marked'/);
  const composer = fs.readFileSync(path.join(root, "js/gastric-biopsy-report.js"), "utf8");
  assert.match(composer, /Not identified.*Mild.*Moderate.*Marked/s);
  assert.match(composer, /STOMACH, biopsy/);
  assert.doesNotMatch(composer, /STOMACH, antrum, biopsy/);
  assert.doesNotMatch(composer, /key:\s*"dysplasia"/);
  assert.doesNotMatch(composer, /key:\s*"malignancy"/);
});

async function testLiveSheet() {
  const names = [
    "parseCSV",
    "detectIsSection",
    "parseRowsFromCSV",
    "categoryDisplayLabel",
    "buildCategories",
  ];
  const code = names.map((n) => extractFunction(src, n)).join("\n");
  const api = new Function(code + "; return { " + names.join(", ") + " };")();
  const csv = await fetchText(PUBLISHED_CSV);
  const rows = api.parseRowsFromCSV(api.parseCSV(csv));
  const categories = api.buildCategories(rows);
  const small = categories.find((c) => /small biopsy/i.test(c.label) || /small biopsy/i.test(c.raw));
  assert.ok(small, "SMALL BIOPSY TEMPLATE category missing from sheet wiring");
  const templateNames = small.templates.map((t) => t.name);
  assert.ok(templateNames.includes("Gastritis"), "Gastritis template missing: " + templateNames.join(", "));
  assert.ok(templateNames.includes("Colitis"), "Colitis template missing: " + templateNames.join(", "));
  const gastritis = small.templates.find((t) => t.name === "Gastritis");
  assert.match(gastritis.body, /CHRONIC GASTRITIS/);
  assert.match(gastritis.body, /Helicobacter/);
  // Other sessions must still be present too
  const labels = categories.map((c) => c.label);
  assert.ok(labels.some((l) => /cancer reporting/i.test(l)), "CANCER REPORTING category missing");
}

testLiveSheet()
  .then(() => {
    console.log("ok  published sheet still exposes SMALL BIOPSY TEMPLATE (Gastritis, Colitis) via unchanged parser");
  })
  .catch((err) => {
    failed++;
    console.error("FAIL  published sheet still exposes SMALL BIOPSY TEMPLATE (Gastritis, Colitis) via unchanged parser");
    console.error("  " + (err && err.stack ? err.stack : err));
  })
  .finally(() => {
    if (failed) {
      console.error("\n" + failed + " failed");
      process.exit(1);
    }
    console.log("\nAll small-biopsy mode / template-path tests passed");
    process.exit(0);
  });
