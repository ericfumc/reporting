"use strict";

/**
 * Gastric small-biopsy report composer.
 * Phrases marked "from template" are taken from Eric Fu's Gastritis
 * entry under SMALL BIOPSY TEMPLATE. Other wording is drafted.
 * This builder is for benign, non-neoplastic mucosa only.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GastricBiopsyReport = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GRADE_IDS = ["mild", "moderate", "marked"];

  const GROUPS = [
    {
      key: "mucosa",
      label: "Type of mucosa",
      options: [
        { id: "antral", label: "Antral" },
        { id: "oxyntic", label: "Oxyntic (body)" },
        { id: "transitional", label: "Transitional" },
        { id: "cardiac", label: "Cardiac" },
        { id: "indeterminate", label: "Indeterminate" },
      ],
    },
    {
      key: "chronicity",
      label: "Chronicity",
      options: [
        { id: "none", label: "No chronic" },
        { id: "mild", label: "Mild" },
        { id: "moderate", label: "Moderate" },
        { id: "severe", label: "Severe" },
      ],
    },
    {
      key: "activity",
      label: "Activity",
      options: [
        { id: "none", label: "No activity" },
        { id: "mild", label: "Mild" },
        { id: "moderate", label: "Moderate" },
        { id: "severe", label: "Severe" },
      ],
    },
    {
      key: "im",
      label: "Intestinal metaplasia",
      options: [
        { id: "none", label: "Not identified" },
        { id: "mild", label: "Mild" },
        { id: "moderate", label: "Moderate" },
        { id: "marked", label: "Marked" },
      ],
    },
    {
      key: "helicobacter",
      label: "Helicobacter organisms",
      options: [
        { id: "none", label: "Not identified" },
        { id: "mild", label: "Mild" },
        { id: "moderate", label: "Moderate" },
        { id: "marked", label: "Marked" },
      ],
    },
  ];

  const EMPTY = {
    mucosa: null,
    chronicity: null,
    activity: null,
    im: null,
    helicobacter: null,
  };

  const BENIGN_CLOSER = "There is no dysplasia or evidence of malignancy."; // from template; always used

  function isPresentGrade(value) {
    return GRADE_IDS.indexOf(value) !== -1;
  }

  function hasAnySelection(sel) {
    return GROUPS.some((g) => sel[g.key]);
  }

  function withStop(text) {
    const s = String(text || "").trim();
    if (!s) return "";
    return /[.!?]$/.test(s) ? s : s + ".";
  }

  function headerLine() {
    return "STOMACH, biopsy";
  }

  function mucosaPhrase(mucosa) {
    switch (mucosa) {
      case "antral":
        return "antral gastric mucosa"; // drafted, parallel to template pattern
      case "oxyntic":
        return "body-type gastric mucosa"; // from template
      case "transitional":
        return "junctional gastric mucosa"; // from template
      case "cardiac":
        return "cardiac gastric mucosa"; // drafted
      case "indeterminate":
        return "gastric mucosa of indeterminate type"; // drafted
      default:
        return "gastric mucosa"; // drafted
    }
  }

  function chronicityPhrase(chronicity) {
    switch (chronicity) {
      case "none":
        return "no chronic inflammation"; // drafted, inverse of template "mild chronic inflammation"
      case "mild":
        return "mild chronic inflammation"; // from template
      case "moderate":
        return "moderate chronic inflammation"; // drafted, same pattern
      case "severe":
        return "severe chronic inflammation"; // drafted, same pattern
      default:
        return "";
    }
  }

  function activityPhrase(activity) {
    switch (activity) {
      case "none":
        return "no activity"; // from template
      case "mild":
        return "mild activity"; // drafted (Sydney grading; his sheet links the Sydney figure)
      case "moderate":
        return "moderate activity"; // drafted
      case "severe":
        return "severe activity"; // drafted
      default:
        return "";
    }
  }

  function isChronic(sel) {
    return Boolean(sel.chronicity && sel.chronicity !== "none");
  }
  function isActive(sel) {
    return Boolean(sel.activity && sel.activity !== "none");
  }

  function gastritisDiagnosis(sel) {
    const chronic = isChronic(sel);
    const active = isActive(sel);
    const hpPresent = isPresentGrade(sel.helicobacter);
    const hpAbsent = sel.helicobacter === "none";

    if (hpPresent) {
      if (chronic && active) return "HELICOBACTER-ASSOCIATED ACTIVE CHRONIC GASTRITIS."; // from template
      if (chronic) return "HELICOBACTER-ASSOCIATED CHRONIC GASTRITIS."; // drafted
      if (active) return "HELICOBACTER-ASSOCIATED ACTIVE GASTRITIS."; // drafted
      return "HELICOBACTER ORGANISMS IDENTIFIED."; // drafted (unusual combo)
    }

    if (chronic && active) {
      return hpAbsent
        ? "ACTIVE CHRONIC GASTRITIS, negative for Helicobacter." // from template
        : "ACTIVE CHRONIC GASTRITIS."; // drafted (HP not commented)
    }
    if (chronic) return "CHRONIC GASTRITIS."; // from template
    if (active) {
      return hpAbsent
        ? "ACTIVE GASTRITIS, negative for Helicobacter." // drafted
        : "ACTIVE GASTRITIS."; // drafted
    }
    return "";
  }

  function noSignificantAbnormality(sel) {
    if (sel.chronicity !== "none" || sel.activity !== "none") return false;
    if (isPresentGrade(sel.im) || isPresentGrade(sel.helicobacter)) return false;
    return sel.im === "none" && sel.helicobacter === "none";
  }

  function diagnosisItems(sel) {
    const items = [];
    const gastritis = gastritisDiagnosis(sel);
    if (gastritis) items.push(gastritis);
    else if (noSignificantAbnormality(sel)) {
      items.push("NO SIGNIFICANT ABNORMALITY."); // drafted
    }
    if (isPresentGrade(sel.im)) items.push("INTESTINAL METAPLASIA present."); // from template; ungraded
    return items;
  }

  function openingSentence(sel) {
    const mucosa = mucosaPhrase(sel.mucosa);
    const chronic = chronicityPhrase(sel.chronicity);
    const activity = activityPhrase(sel.activity);
    const withBits = [chronic, activity].filter(Boolean);
    if (withBits.length) {
      return "Section shows " + mucosa + " with " + withBits.join(" and ") + ".";
    }
    return "Section shows " + mucosa + ".";
  }

  function imSentence(im) {
    if (im === "none") return "No intestinal metaplasia is seen."; // from template
    if (im === "mild") return "Mild intestinal metaplasia is seen.";
    if (im === "moderate") return "Moderate intestinal metaplasia is seen.";
    if (im === "marked") return "Marked intestinal metaplasia is seen.";
    return "";
  }

  function helicobacterSentence(helicobacter) {
    if (helicobacter === "none") return "No Helicobacter organisms are identified."; // from template
    if (helicobacter === "mild") return "Mild amount of Helicobacter organisms are identified.";
    if (helicobacter === "moderate") return "Moderate amount of Helicobacter organisms are identified.";
    if (helicobacter === "marked") return "Marked amount of Helicobacter organisms are identified.";
    return "";
  }

  function microParagraph(sel) {
    const sentences = [
      openingSentence(sel),
      imSentence(sel.im),
      helicobacterSentence(sel.helicobacter),
      BENIGN_CLOSER,
    ].filter(Boolean);
    return sentences.join(" ");
  }

  function composeDiagnosisBlock(sel) {
    const items = diagnosisItems(sel);
    const header = headerLine();
    if (!items.length) return withStop(header);
    if (items.length === 1) return header + ": - " + items[0];
    return header + ": - " + items[0] + "\n" + items.slice(1).map((item) => "- " + item).join("\n");
  }

  function composeReport(input) {
    const sel = Object.assign({}, EMPTY, input || {});
    if (!hasAnySelection(sel)) return "";
    return composeDiagnosisBlock(sel) + "\n" + microParagraph(sel);
  }

  return {
    GROUPS,
    EMPTY,
    BENIGN_CLOSER,
    composeReport,
    diagnosisItems,
    microParagraph,
    headerLine,
  };
});
