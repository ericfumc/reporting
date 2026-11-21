"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { composeReport, GROUPS } = require("../js/gastric-biopsy-report.js");

const root = path.resolve(__dirname, "..");

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

test("preview composer is identical to the live js copy", () => {
  const live = fs.readFileSync(path.join(root, "js/gastric-biopsy-report.js"), "utf8");
  const preview = fs.readFileSync(path.join(root, "preview/gastric-biopsy-report.js"), "utf8");
  assert.strictEqual(preview, live);
});

test("seven mutually exclusive button groups are defined", () => {
  const keys = GROUPS.map((g) => g.key);
  assert.deepStrictEqual(keys, [
    "mucosa",
    "chronicity",
    "activity",
    "im",
    "helicobacter",
    "dysplasia",
    "malignancy",
  ]);
  GROUPS.forEach((g) => assert.ok(g.options.length >= 2, g.key + " needs options"));
});

test("typical antral active chronic gastritis with IM and Helicobacter", () => {
  const text = composeReport({
    mucosa: "antral",
    chronicity: "moderate",
    activity: "mild",
    im: "present",
    helicobacter: "present",
    dysplasia: "none",
    malignancy: "none",
  });
  assert.strictEqual(
    text,
    [
      "STOMACH, antrum, biopsy: - HELICOBACTER-ASSOCIATED ACTIVE CHRONIC GASTRITIS.",
      "- INTESTINAL METAPLASIA present.",
      "Section shows antral gastric mucosa with moderate chronic inflammation and mild activity. Intestinal metaplasia is present. Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("transitional mucosa uses junctional in the header, not the word transitional", () => {
  const text = composeReport({
    mucosa: "transitional",
    chronicity: "mild",
    activity: "none",
    im: "none",
    helicobacter: "none",
    dysplasia: "none",
    malignancy: "none",
  });
  const [diagnosis, micro] = text.split("\n");
  assert.strictEqual(diagnosis, "STOMACH, junctional, biopsy: - CHRONIC GASTRITIS.");
  assert.doesNotMatch(diagnosis, /transitional/i);
  assert.match(micro, /junctional gastric mucosa/);
  assert.strictEqual(
    text,
    [
      "STOMACH, junctional, biopsy: - CHRONIC GASTRITIS.",
      "Section shows junctional gastric mucosa with mild chronic inflammation and no activity. No intestinal metaplasia is seen. No Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("grades stay in the microscopic text only, never on the diagnosis line", () => {
  const cases = [
    { chronicity: "mild", activity: "none", helicobacter: "none" },
    { chronicity: "moderate", activity: "mild", helicobacter: "present" },
    { chronicity: "severe", activity: "severe", helicobacter: "none" },
  ];
  for (const sel of cases) {
    const text = composeReport(Object.assign({ mucosa: "antral", dysplasia: "none", malignancy: "none" }, sel));
    const diagnosis = text.split("\n")[0];
    const micro = text.split("\n").slice(-1)[0];
    assert.doesNotMatch(diagnosis, /mild|moderate|severe/i, "grade leaked into diagnosis: " + diagnosis);
    assert.match(micro, /Section shows/);
    if (sel.chronicity) assert.match(micro, new RegExp(sel.chronicity + " chronic inflammation"));
    if (sel.activity && sel.activity !== "none") assert.match(micro, new RegExp(sel.activity + " activity"));
  }
});

test("unselected fields are omitted cleanly", () => {
  const text = composeReport({ mucosa: "antral" });
  assert.strictEqual(
    text,
    ["STOMACH, antrum, biopsy.", "Section shows antral gastric mucosa."].join("\n")
  );
  assert.doesNotMatch(text, /intestinal metaplasia/i);
  assert.doesNotMatch(text, /Helicobacter/);
  assert.doesNotMatch(text, /dysplasia/);
  assert.doesNotMatch(text, /malignancy/i);
  assert.doesNotMatch(text, /chronic inflammation/);
  assert.doesNotMatch(text, /activity/);
});

test("empty selection yields an empty report", () => {
  assert.strictEqual(composeReport({}), "");
  assert.strictEqual(composeReport(), "");
});

test("explicitly negative findings yield a drafted no-significant-abnormality line", () => {
  const text = composeReport({
    mucosa: "oxyntic",
    chronicity: "none",
    activity: "none",
    im: "none",
    helicobacter: "none",
    dysplasia: "none",
    malignancy: "none",
  });
  assert.strictEqual(
    text,
    [
      "STOMACH, body, biopsy: - NO SIGNIFICANT ABNORMALITY.",
      "Section shows body-type gastric mucosa with no chronic inflammation and no activity. No intestinal metaplasia is seen. No Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("active chronic gastritis, Helicobacter not identified, uses the template diagnosis", () => {
  const text = composeReport({
    mucosa: "antral",
    chronicity: "mild",
    activity: "moderate",
    helicobacter: "none",
  });
  assert.match(text, /STOMACH, antrum, biopsy: - ACTIVE CHRONIC GASTRITIS, negative for Helicobacter\./);
  assert.match(text, /with mild chronic inflammation and moderate activity\./);
  assert.match(text, /No Helicobacter organisms are identified\./);
  assert.doesNotMatch(text, /intestinal metaplasia/);
  assert.doesNotMatch(text, /dysplasia/);
});

test("unselected Helicobacter does not claim organisms are absent in the diagnosis", () => {
  const text = composeReport({
    mucosa: "cardiac",
    chronicity: "severe",
    activity: "mild",
  });
  assert.match(text, /STOMACH, cardia, biopsy: - ACTIVE CHRONIC GASTRITIS\.$/m);
  assert.doesNotMatch(text, /negative for Helicobacter/);
  assert.doesNotMatch(text, /Helicobacter organisms/);
});

test("dysplasia and malignancy wording, including no double full stop", () => {
  const withFreeText = composeReport({
    mucosa: "indeterminate",
    dysplasia: "high",
    malignancy: "present",
    malignancyText: "adenocarcinoma.",
  });
  assert.strictEqual(
    withFreeText,
    [
      "STOMACH, biopsy: - HIGH-GRADE DYSPLASIA.",
      "- MALIGNANCY PRESENT (adenocarcinoma).",
      "Section shows gastric mucosa of indeterminate type. High-grade dysplasia is present. Malignancy is present (adenocarcinoma).",
    ].join("\n")
  );

  const noMal = composeReport({
    mucosa: "antral",
    dysplasia: "indefinite",
    malignancy: "none",
  });
  assert.match(noMal, /INDEFINITE FOR DYSPLASIA\./);
  assert.match(noMal, /The features are indefinite for dysplasia\. There is no evidence of malignancy\./);
});

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nAll gastric composer tests passed");
