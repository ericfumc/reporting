import React, { useState, useEffect } from "react";
import breast from "./data/breast.json";
import colorectal from "./data/colorectal.json";
import endometrium from "./data/endometrium.json";
import { formatReport } from "./utils/formatReport";

const templates = { breast, colorectal, endometrium };

export default function App() {
  const [templateName, setTemplateName] = useState("breast");
  const [data, setData] = useState(templates.breast);
  const [values, setValues] = useState({});

  useEffect(() => {
    setData(templates[templateName]);
    setValues({});
  }, [templateName]);

  const handleInput = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(formatReport(data, values));
    alert("Report copied to clipboard");
  };

  const handleDownload = () => {
    const text = formatReport(data, values);
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${data.templateName.replace(/\s+/g, "_")}_Report.txt`;
    a.click();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">ICCR Report Generator</h1>

      <select
        value={templateName}
        onChange={(e) => setTemplateName(e.target.value)}
        className="border rounded p-2 mb-6"
      >
        <option value="breast">Breast</option>
        <option value="colorectal">Colorectal</option>
        <option value="endometrium">Endometrium</option>
      </select>

      {data.categories.map((cat) => (
        <div key={cat.name} className="mb-6">
          <h2 className="font-semibold text-lg mb-2">{cat.name}</h2>
          <div className="grid grid-cols-1 gap-2">
            {cat.fields.map((f) => (
              <div key={f.label} className="flex gap-2">
                <label className="w-64">{f.label}</label>
                <input
                  className="flex-1 border rounded px-2 py-1"
                  value={values[f.label] || ""}
                  onChange={(e) => handleInput(f.label, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="mt-8">
        <h2 className="font-semibold mb-2">Report Preview</h2>
        <textarea
          className="w-full h-96 font-mono border rounded p-2 bg-gray-50"
          readOnly
          value={formatReport(data, values)}
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={handleCopy} className="bg-blue-600 text-white px-4 py-2 rounded">
          Copy to Clipboard
        </button>
        <button onClick={handleDownload} className="bg-gray-700 text-white px-4 py-2 rounded">
          Download .txt
        </button>
      </div>
    </div>
  );
}
