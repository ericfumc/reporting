"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { composeReport, GROUPS, headerLine, TYPICAL, EMPTY } = require("../js/gastric-biopsy-report.js");

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

function diagnosisBlock(text) {
  const parts = text.split("\n\n");
  assert.ok(parts.length >= 2, "expected a blank line between diagnosis and micro: " + JSON.stringify(text));
  return parts[0];
}

function microBlock(text) {
  const parts = text.split("\n\n");
  return parts.slice(1).join("\n\n");
}

test("preview composer is identical to the live js copy", () => {
  const live = fs.readFileSync(path.join(root, "js/gastric-biopsy-report.js"), "utf8");
  const preview = fs.readFileSync(path.join(root, "preview/gastric-biopsy-report.js"), "utf8");
  assert.strictEqual(preview, live);
});

test("mucosa options are antral-type, junctional, body-type, cardiac-type", () => {
  const mucosa = GROUPS.find((g) => g.key === "mucosa");
  assert.deepStrictEqual(
    mucosa.options.map((o) => o.id),
    ["antral-type", "junctional", "body-type", "cardiac-type"]
  );
  assert.deepStrictEqual(
    mucosa.options.map((o) => o.label),
    ["antral-type", "junctional", "body-type", "cardiac-type"]
  );
  const ids = GROUPS.map((g) => g.key);
  assert.deepStrictEqual(ids, ["mucosa", "chronicity", "activity", "im", "helicobacter"]);
});

test("chronicity and activity use Marked, not Severe", () => {
  for (const key of ["chronicity", "activity"]) {
    const ids = GROUPS.find((g) => g.key === key).options.map((o) => o.id);
    const labels = GROUPS.find((g) => g.key === key).options.map((o) => o.label);
    assert.deepStrictEqual(ids, ["none", "mild", "moderate", "marked"]);
    assert.ok(labels.includes("Marked"));
    assert.ok(!ids.includes("severe"));
    assert.ok(!labels.includes("Severe"));
  }
});

test("typical / default selection is mild chronic gastritis", () => {
  assert.deepStrictEqual(TYPICAL, {
    mucosa: "antral-type",
    chronicity: "mild",
    activity: "none",
    im: "none",
    helicobacter: "none",
  });
  const text = composeReport(TYPICAL);
  assert.strictEqual(
    text,
    [
      "STOMACH, biopsy:",
      "- CHRONIC GASTRITIS.",
      "",
      "Section shows antral-type gastric mucosa with mild chronic inflammation and no activity. No intestinal metaplasia is seen. No Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
  assert.strictEqual(composeReport(EMPTY), "");
});

test("active chronic gastritis with IM and Helicobacter still composes correctly", () => {
  const text = composeReport({
    mucosa: "antral-type",
    chronicity: "moderate",
    activity: "mild",
    im: "mild",
    helicobacter: "marked",
  });
  assert.strictEqual(
    text,
    [
      "STOMACH, biopsy:",
      "- HELICOBACTER-ASSOCIATED ACTIVE CHRONIC GASTRITIS.",
      "- INTESTINAL METAPLASIA present.",
      "",
      "Section shows antral-type gastric mucosa with moderate chronic inflammation and mild activity. Mild intestinal metaplasia is seen. Marked amount of Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("diagnosis header is always STOMACH, biopsy: on its own line, with mucosa type only in the micro text", () => {
  assert.strictEqual(headerLine(), "STOMACH, biopsy");
  const sites = {
    "antral-type": "antral-type gastric mucosa",
    junctional: "junctional gastric mucosa",
    "body-type": "body-type gastric mucosa",
    "cardiac-type": "cardiac-type gastric mucosa",
  };
  for (const [mucosa, phrase] of Object.entries(sites)) {
    const text = composeReport({ mucosa, chronicity: "mild" });
    const diagnosis = diagnosisBlock(text);
    assert.ok(diagnosis.startsWith("STOMACH, biopsy:\n- "), diagnosis);
    assert.doesNotMatch(diagnosis, /antral|junctional|body|cardia/i);
    assert.match(microBlock(text), new RegExp("Section shows " + phrase));
  }
  const junctional = composeReport({
    mucosa: "junctional",
    chronicity: "mild",
    activity: "none",
    im: "none",
    helicobacter: "none",
  });
  assert.strictEqual(
    junctional,
    [
      "STOMACH, biopsy:",
      "- CHRONIC GASTRITIS.",
      "",
      "Section shows junctional gastric mucosa with mild chronic inflammation and no activity. No intestinal metaplasia is seen. No Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("grades stay in the microscopic text only, never on the diagnosis line", () => {
  const cases = [
    { chronicity: "mild", activity: "none", helicobacter: "none", im: "none" },
    { chronicity: "moderate", activity: "mild", helicobacter: "marked", im: "mild" },
    { chronicity: "marked", activity: "marked", helicobacter: "moderate", im: "marked" },
  ];
  for (const sel of cases) {
    const text = composeReport(Object.assign({ mucosa: "antral-type" }, sel));
    const diagnosis = diagnosisBlock(text);
    const micro = microBlock(text);
    assert.doesNotMatch(diagnosis, /mild|moderate|severe|marked/i, "grade leaked into diagnosis: " + diagnosis);
    if (sel.im && sel.im !== "none") {
      assert.match(diagnosis, /INTESTINAL METAPLASIA present\./);
    }
    assert.match(micro, /Section shows/);
    if (sel.chronicity) assert.match(micro, new RegExp(sel.chronicity + " chronic inflammation"));
    if (sel.activity && sel.activity !== "none") assert.match(micro, new RegExp(sel.activity + " activity"));
  }
});

test("marked chronicity and activity use marked, not severe", () => {
  const text = composeReport({
    mucosa: "body-type",
    chronicity: "marked",
    activity: "marked",
  });
  assert.match(microBlock(text), /with marked chronic inflammation and marked activity\./);
  assert.doesNotMatch(text, /severe/i);
});

test("graded IM and Helicobacter microscopic sentences", () => {
  const mildBoth = composeReport({ mucosa: "antral-type", im: "mild", helicobacter: "mild" });
  assert.match(mildBoth, /Mild intestinal metaplasia is seen\./);
  assert.match(mildBoth, /Mild amount of Helicobacter organisms are identified\./);

  const moderate = composeReport({ mucosa: "antral-type", im: "moderate", helicobacter: "moderate" });
  assert.match(moderate, /Moderate intestinal metaplasia is seen\./);
  assert.match(moderate, /Moderate amount of Helicobacter organisms are identified\./);

  const marked = composeReport({ mucosa: "antral-type", im: "marked", helicobacter: "marked" });
  assert.match(marked, /Marked intestinal metaplasia is seen\./);
  assert.match(marked, /Marked amount of Helicobacter organisms are identified\./);

  const absent = composeReport({ mucosa: "antral-type", im: "none", helicobacter: "none" });
  assert.match(absent, /No intestinal metaplasia is seen\./);
  assert.match(absent, /No Helicobacter organisms are identified\./);
});

test("unselected IM/HP fields are omitted, but the benign closer is always present", () => {
  const text = composeReport({ mucosa: "antral-type" });
  assert.strictEqual(
    text,
    [
      "STOMACH, biopsy:",
      "",
      "Section shows antral-type gastric mucosa. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
  assert.doesNotMatch(text, /intestinal metaplasia/i);
  assert.doesNotMatch(text, /Helicobacter organisms/);
  assert.doesNotMatch(text, /chronic inflammation/);
  assert.doesNotMatch(text, /activity/);
});

test("empty selection yields an empty report", () => {
  assert.strictEqual(composeReport({}), "");
  assert.strictEqual(composeReport(), "");
});

test("explicitly negative findings yield a drafted no-significant-abnormality line", () => {
  const text = composeReport({
    mucosa: "body-type",
    chronicity: "none",
    activity: "none",
    im: "none",
    helicobacter: "none",
  });
  assert.strictEqual(
    text,
    [
      "STOMACH, biopsy:",
      "- NO SIGNIFICANT ABNORMALITY.",
      "",
      "Section shows body-type gastric mucosa with no chronic inflammation and no activity. No intestinal metaplasia is seen. No Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("active chronic gastritis, Helicobacter not identified, uses the template diagnosis", () => {
  const text = composeReport({
    mucosa: "antral-type",
    chronicity: "mild",
    activity: "moderate",
    helicobacter: "none",
  });
  assert.strictEqual(
    diagnosisBlock(text),
    ["STOMACH, biopsy:", "- ACTIVE CHRONIC GASTRITIS, negative for Helicobacter."].join("\n")
  );
  assert.match(microBlock(text), /with mild chronic inflammation and moderate activity\./);
  assert.match(microBlock(text), /No Helicobacter organisms are identified\./);
  assert.doesNotMatch(text, /intestinal metaplasia/);
});

test("unselected Helicobacter does not claim organisms are absent in the diagnosis", () => {
  const text = composeReport({
    mucosa: "cardiac-type",
    chronicity: "marked",
    activity: "mild",
  });
  assert.strictEqual(
    diagnosisBlock(text),
    ["STOMACH, biopsy:", "- ACTIVE CHRONIC GASTRITIS."].join("\n")
  );
  assert.doesNotMatch(text, /negative for Helicobacter/);
  assert.doesNotMatch(text, /Helicobacter organisms/);
  assert.match(microBlock(text), /cardiac-type gastric mucosa with marked chronic inflammation and mild activity/);
});

test("dysplasia and malignancy are not selectable; closer is fixed", () => {
  const text = composeReport({ mucosa: "junctional", chronicity: "mild" });
  assert.match(text, /There is no dysplasia or evidence of malignancy\.$/);
  assert.doesNotMatch(text, /INDEFINITE FOR DYSPLASIA|LOW-GRADE DYSPLASIA|HIGH-GRADE DYSPLASIA|MALIGNANCY PRESENT/);
  const ignored = composeReport({
    mucosa: "antral-type",
    dysplasia: "high",
    malignancy: "present",
    malignancyText: "adenocarcinoma.",
  });
  assert.strictEqual(
    ignored,
    [
      "STOMACH, biopsy:",
      "",
      "Section shows antral-type gastric mucosa. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nAll gastric composer tests passed");
