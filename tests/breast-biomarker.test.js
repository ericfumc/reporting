"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const pages = [
  path.join(root, "breast-biomarker.html"),
  path.join(root, "preview/breast-biomarker.html"),
];

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

function loadApi(src) {
  const names = [
    "expandPct",
    "formatNum",
    "roundHalfUp",
    "proportionScore",
    "calculate",
    "fillRemainderIntoZero",
  ];
  const code = names.map((n) => extractFunction(src, n)).join("\n");
  return new Function(code + "; return { " + names.join(", ") + " };")();
}

function buttonLoop(src) {
  const m = src.match(/for\s*\(\s*let\s+n\s*=\s*0;\s*n\s*<=\s*(\d+)\s*;\s*n\+\+\s*\)/);
  if (!m) throw new Error("button loop not found");
  return Number(m[1]);
}

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

for (const page of pages) {
  const rel = path.relative(root, page);
  const src = fs.readFileSync(page, "utf8");

  test(rel + " builds buttons 0–9 only", () => {
    assert.strictEqual(buttonLoop(src), 9);
    assert.equal((src.match(/for\s*\(\s*let\s+n\s*=\s*0;\s*n\s*<=\s*10\s*;/g) || []).length, 0);
    assert.match(src, /buttons 0–9/);
    assert.doesNotMatch(src, /buttons 0–10/);
    assert.doesNotMatch(src, /10 means 10%/);
    // A selected value of 10 must not be written by fill-remainder.
    assert.match(src, /tens\s*>\s*9/);
  });

  const api = loadApi(src);

  test(rel + " expandPct: 0–9 are tens of percent", () => {
    assert.strictEqual(api.expandPct(0), 0);
    assert.strictEqual(api.expandPct(1), 10);
    assert.strictEqual(api.expandPct(2), 20);
    assert.strictEqual(api.expandPct(9), 90);
    assert.strictEqual(api.expandPct(null), null);
  });

  test(rel + " scoring unchanged when values total 100%", () => {
    // Default pad: 1,2,5,2 → 10+20+50+20
    const a = api.calculate(10, 20, 50, 20);
    assert.strictEqual(a.hScore, 180);
    assert.strictEqual(a.positive, 90);
    assert.strictEqual(a.ps, 5);
    assert.strictEqual(a.is, 2);
    assert.strictEqual(a.allred, 7);

    // All negative: 100% at intensity 0 is still a valid score if entered internally
    const b = api.calculate(100, 0, 0, 0);
    assert.strictEqual(b.hScore, 0);
    assert.strictEqual(b.positive, 0);
    assert.strictEqual(b.ps, 0);
    assert.strictEqual(b.is, 0);
    assert.strictEqual(b.allred, 0);

    // 10% 1+ and 90% 0 (buttons 1 and 9)
    const c = api.calculate(90, 10, 0, 0);
    assert.strictEqual(c.hScore, 10);
    assert.strictEqual(c.positive, 10);
    assert.strictEqual(c.ps, 2);
    assert.strictEqual(c.is, 1);
    assert.strictEqual(c.allred, 3);
  });

  test(rel + " fill remainder 10% selects button 1, not 10", () => {
    const result = api.fillRemainderIntoZero({ p1: 2, p2: 5, p3: 2 }); // 20+50+20, rest 10
    assert.deepStrictEqual(
      { ok: result.ok, shorthand: result.shorthand, rest: result.rest },
      { ok: true, shorthand: 1, rest: 10 }
    );
  });

  test(rel + " fill remainder maps 0/20/90% onto buttons 0/2/9", () => {
    assert.strictEqual(api.fillRemainderIntoZero({ p1: 3, p2: 4, p3: 3 }).shorthand, 0);
    assert.strictEqual(api.fillRemainderIntoZero({ p1: 2, p2: 4, p3: 2 }).shorthand, 2);
    assert.strictEqual(api.fillRemainderIntoZero({ p1: 1, p2: 0, p3: 0 }).shorthand, 9);
  });

  test(rel + " fill remainder 100% does not point at a missing button 10", () => {
    const result = api.fillRemainderIntoZero({ p1: 0, p2: 0, p3: 0 });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.shorthand, null);
    assert.strictEqual(result.rest, 100);
    assert.match(result.message, /100%/);
    assert.notStrictEqual(result.shorthand, 10);
  });

  test(rel + " fill remainder rejects a non-multiple of 10", () => {
    // 15 is not a 0–9 shorthand, so expandPct leaves it as 15% and the remainder is 85%.
    const odd = api.fillRemainderIntoZero({ p1: 15, p2: 0, p3: 0 });
    assert.strictEqual(odd.ok, false);
    assert.strictEqual(odd.shorthand, null);
    assert.strictEqual(odd.rest, 85);
    assert.match(odd.message, /85%/);
  });
}

if (failed) {
  console.error("\n" + failed + " failed");
  process.exit(1);
}
console.log("\nall tests passed");
