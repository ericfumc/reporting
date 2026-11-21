"use strict";

/**
 * Gastric small-biopsy report composer.
 * Phrases marked "from template" are taken from Eric Fu's Gastritis
 * entry under SMALL BIOPSY TEMPLATE. Other wording is drafted.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GastricBiopsyReport = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
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
        { id: "present", label: "Present" },
      ],
    },
    {
      key: "helicobacter",
      label: "Helicobacter organisms",
      options: [
        { id: "none", label: "Not identified" },
        { id: "present", label: "Present" },
      ],
    },
    {
      key: "dysplasia",
      label: "Dysplasia",
      options: [
        { id: "none", label: "No dysplasia" },
        { id: "indefinite", label: "Indefinite" },
        { id: "low", label: "Low-grade" },
        { id: "high", label: "High-grade" },
      ],
    },
    {
      key: "malignancy",
      label: "Malignancy",
      options: [
        { id: "none", label: "No malignancy" },
        { id: "present", label: "Present" },
      ],
    },
  ];

  const EMPTY = {
    mucosa: null,
    chronicity: null,
    activity: null,
    im: null,
    helicobacter: null,
    dysplasia: null,
    malignancy: null,
    malignancyText: "",
  };

  function hasAnySelection(sel) {
    return GROUPS.some((g) => sel[g.key]) || Boolean(String(sel.malignancyText || "").trim());
  }

  function withStop(text) {
    const s = String(text || "").trim();
    if (!s) return "";
    return /[.!?]$/.test(s) ? s : s + ".";
  }

  function headerLine(mucosa) {
    switch (mucosa) {
      case "antral":
        return "STOMACH, antrum, biopsy"; // site word from template ("antrum")
      case "oxyntic":
        return "STOMACH, body, biopsy"; // drafted site; micro uses "body-type" from template
      case "transitional":
        return "STOMACH, junctional, biopsy"; // "junctional" from template micro
      case "cardiac":
        return "STOMACH, cardia, biopsy"; // drafted
      case "indeterminate":
        return "STOMACH, biopsy"; // drafted
      default:
        return "STOMACH, biopsy"; // drafted
    }
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
    const hpPresent = sel.helicobacter === "present";
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
    if (sel.im === "present" || sel.helicobacter === "present") return false;
    if (sel.dysplasia && sel.dysplasia !== "none") return false;
    if (sel.malignancy === "present") return false;
    // Only claim this when the main negative findings were explicitly chosen.
    return (
      sel.im === "none" &&
      sel.helicobacter === "none" &&
      sel.dysplasia === "none" &&
      sel.malignancy === "none"
    );
  }

  function diagnosisItems(sel) {
    const items = [];
    const gastritis = gastritisDiagnosis(sel);
    if (gastritis) items.push(gastritis);
    else if (noSignificantAbnormality(sel)) {
      items.push("NO SIGNIFICANT ABNORMALITY."); // drafted
    }
    if (sel.im === "present") items.push("INTESTINAL METAPLASIA present."); // from template
    if (sel.dysplasia === "indefinite") items.push("INDEFINITE FOR DYSPLASIA."); // drafted
    if (sel.dysplasia === "low") items.push("LOW-GRADE DYSPLASIA."); // drafted
    if (sel.dysplasia === "high") items.push("HIGH-GRADE DYSPLASIA."); // drafted
    if (sel.malignancy === "present") {
      const extra = String(sel.malignancyText || "").trim();
      if (extra) {
        const inner = extra.replace(/[.]+$/, "");
        items.push("MALIGNANCY PRESENT (" + inner + ")."); // drafted
      } else {
        items.push("MALIGNANCY PRESENT."); // drafted
      }
    }
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
    if (im === "present") return "Intestinal metaplasia is present."; // drafted (diagnosis uses "present")
    return "";
  }

  function helicobacterSentence(helicobacter) {
    if (helicobacter === "none") return "No Helicobacter organisms are identified."; // from template
    if (helicobacter === "present") return "Helicobacter organisms are identified."; // drafted, parallel
    return "";
  }

  function dysplasiaSentence(dysplasia) {
    switch (dysplasia) {
      case "none":
        return "";
      case "indefinite":
        return "The features are indefinite for dysplasia."; // drafted
      case "low":
        return "Low-grade dysplasia is present."; // drafted
      case "high":
        return "High-grade dysplasia is present."; // drafted
      default:
        return "";
    }
  }

  function malignancySentence(sel) {
    if (sel.malignancy === "present") {
      const extra = String(sel.malignancyText || "").trim();
      if (extra) return withStop("Malignancy is present (" + extra.replace(/[.]+$/, "") + ")");
      return "Malignancy is present.";
    }
    return "";
  }

  function dysplasiaMalignancySentences(sel) {
    const noDys = sel.dysplasia === "none";
    const noMal = sel.malignancy === "none";
    const dysPos = dysplasiaSentence(sel.dysplasia);
    const malPos = malignancySentence(sel);

    if (noDys && noMal) return "There is no dysplasia or evidence of malignancy."; // from template
    const parts = [];
    if (noDys) parts.push("There is no dysplasia."); // drafted
    else if (dysPos) parts.push(dysPos);
    if (noMal) parts.push("There is no evidence of malignancy."); // drafted (from template "evidence of malignancy")
    else if (malPos) parts.push(malPos);
    return parts.join(" ");
  }

  function microParagraph(sel) {
    const sentences = [
      openingSentence(sel),
      imSentence(sel.im),
      helicobacterSentence(sel.helicobacter),
      dysplasiaMalignancySentences(sel),
    ].filter(Boolean);
    return sentences.join(" ");
  }

  function composeDiagnosisBlock(sel) {
    const items = diagnosisItems(sel);
    const header = headerLine(sel.mucosa);
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
    composeReport,
    diagnosisItems,
    microParagraph,
    headerLine,
  };
});
