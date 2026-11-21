"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { composeReport, GROUPS, headerLine } = require("../js/gastric-biopsy-report.js");

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

test("five button groups: mucosa, chronicity, activity, graded IM, graded Helicobacter", () => {
  const keys = GROUPS.map((g) => g.key);
  assert.deepStrictEqual(keys, [
    "mucosa",
    "chronicity",
    "activity",
    "im",
    "helicobacter",
  ]);
  assert.ok(!keys.includes("dysplasia"));
  assert.ok(!keys.includes("malignancy"));
  const imIds = GROUPS.find((g) => g.key === "im").options.map((o) => o.id);
  const hpIds = GROUPS.find((g) => g.key === "helicobacter").options.map((o) => o.id);
  assert.deepStrictEqual(imIds, ["none", "mild", "moderate", "marked"]);
  assert.deepStrictEqual(hpIds, ["none", "mild", "moderate", "marked"]);
});

test("typical antral example uses graded IM/HP micro sentences and a fixed header", () => {
  const text = composeReport({
    mucosa: "antral",
    chronicity: "moderate",
    activity: "mild",
    im: "mild",
    helicobacter: "marked",
  });
  assert.strictEqual(
    text,
    [
      "STOMACH, biopsy: - HELICOBACTER-ASSOCIATED ACTIVE CHRONIC GASTRITIS.",
      "- INTESTINAL METAPLASIA present.",
      "Section shows antral gastric mucosa with moderate chronic inflammation and mild activity. Mild intestinal metaplasia is seen. Marked amount of Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("diagnosis header is always STOMACH, biopsy, with mucosa type only in the micro text", () => {
  assert.strictEqual(headerLine(), "STOMACH, biopsy");
  const sites = ["antral", "oxyntic", "transitional", "cardiac", "indeterminate"];
  for (const mucosa of sites) {
    const text = composeReport({ mucosa, chronicity: "mild" });
    const diagnosis = text.split("\n")[0];
    assert.ok(diagnosis.startsWith("STOMACH, biopsy"), diagnosis);
    assert.doesNotMatch(diagnosis, /antrum|junctional|body|cardia/i);
  }
  const transitional = composeReport({
    mucosa: "transitional",
    chronicity: "mild",
    activity: "none",
    im: "none",
    helicobacter: "none",
  });
  assert.strictEqual(
    transitional,
    [
      "STOMACH, biopsy: - CHRONIC GASTRITIS.",
      "Section shows junctional gastric mucosa with mild chronic inflammation and no activity. No intestinal metaplasia is seen. No Helicobacter organisms are identified. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

test("grades stay in the microscopic text only, never on the diagnosis line", () => {
  const cases = [
    { chronicity: "mild", activity: "none", helicobacter: "none", im: "none" },
    { chronicity: "moderate", activity: "mild", helicobacter: "marked", im: "mild" },
    { chronicity: "severe", activity: "severe", helicobacter: "moderate", im: "marked" },
  ];
  for (const sel of cases) {
    const text = composeReport(Object.assign({ mucosa: "antral" }, sel));
    const diagnosisLines = text.split("\n").filter((line) => !line.startsWith("Section shows"));
    const diagnosis = diagnosisLines.join("\n");
    const micro = text.split("\n").slice(-1)[0];
    assert.doesNotMatch(diagnosis, /mild|moderate|severe|marked/i, "grade leaked into diagnosis: " + diagnosis);
    if (sel.im && sel.im !== "none") {
      assert.match(diagnosis, /INTESTINAL METAPLASIA present\./);
    }
    assert.match(micro, /Section shows/);
    if (sel.chronicity) assert.match(micro, new RegExp(sel.chronicity + " chronic inflammation"));
    if (sel.activity && sel.activity !== "none") assert.match(micro, new RegExp(sel.activity + " activity"));
  }
});

test("graded IM and Helicobacter microscopic sentences", () => {
  const mildBoth = composeReport({ mucosa: "antral", im: "mild", helicobacter: "mild" });
  assert.match(mildBoth, /Mild intestinal metaplasia is seen\./);
  assert.match(mildBoth, /Mild amount of Helicobacter organisms are identified\./);

  const moderate = composeReport({ mucosa: "antral", im: "moderate", helicobacter: "moderate" });
  assert.match(moderate, /Moderate intestinal metaplasia is seen\./);
  assert.match(moderate, /Moderate amount of Helicobacter organisms are identified\./);

  const marked = composeReport({ mucosa: "antral", im: "marked", helicobacter: "marked" });
  assert.match(marked, /Marked intestinal metaplasia is seen\./);
  assert.match(marked, /Marked amount of Helicobacter organisms are identified\./);

  const absent = composeReport({ mucosa: "antral", im: "none", helicobacter: "none" });
  assert.match(absent, /No intestinal metaplasia is seen\./);
  assert.match(absent, /No Helicobacter organisms are identified\./);
});

test("unselected IM/HP fields are omitted, but the benign closer is always present", () => {
  const text = composeReport({ mucosa: "antral" });
  assert.strictEqual(
    text,
    [
      "STOMACH, biopsy.",
      "Section shows antral gastric mucosa. There is no dysplasia or evidence of malignancy.",
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
    mucosa: "oxyntic",
    chronicity: "none",
    activity: "none",
    im: "none",
    helicobacter: "none",
  });
  assert.strictEqual(
    text,
    [
      "STOMACH, biopsy: - NO SIGNIFICANT ABNORMALITY.",
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
  assert.match(text, /STOMACH, biopsy: - ACTIVE CHRONIC GASTRITIS, negative for Helicobacter\./);
  assert.match(text, /with mild chronic inflammation and moderate activity\./);
  assert.match(text, /No Helicobacter organisms are identified\./);
  assert.doesNotMatch(text, /intestinal metaplasia/);
});

test("unselected Helicobacter does not claim organisms are absent in the diagnosis", () => {
  const text = composeReport({
    mucosa: "cardiac",
    chronicity: "severe",
    activity: "mild",
  });
  assert.match(text, /STOMACH, biopsy: - ACTIVE CHRONIC GASTRITIS\.$/m);
  assert.doesNotMatch(text, /negative for Helicobacter/);
  assert.doesNotMatch(text, /Helicobacter organisms/);
});

test("dysplasia and malignancy are not selectable; closer is fixed", () => {
  const text = composeReport({ mucosa: "indeterminate", chronicity: "mild" });
  assert.match(text, /There is no dysplasia or evidence of malignancy\.$/);
  assert.doesNotMatch(text, /INDEFINITE FOR DYSPLASIA|LOW-GRADE DYSPLASIA|HIGH-GRADE DYSPLASIA|MALIGNANCY PRESENT/);
  const ignored = composeReport({
    mucosa: "antral",
    dysplasia: "high",
    malignancy: "present",
    malignancyText: "adenocarcinoma.",
  });
  assert.strictEqual(
    ignored,
    [
      "STOMACH, biopsy.",
      "Section shows antral gastric mucosa. There is no dysplasia or evidence of malignancy.",
    ].join("\n")
  );
});

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nAll gastric composer tests passed");
