// Renders the branded PDF in the browser and hands it to the user as a file.
//
// Everything PDF-related hangs off this module, and the page imports it with a
// dynamic import — so @react-pdf/renderer (~1 MB) is only fetched the first
// time someone actually asks for a PDF.
import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import AssessmentPdf from "./AssessmentPdf.jsx";

/** "Fraud Detection Triage!" → "fraud-detection-triage" */
function slugify(name) {
  return (
    String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "assessment"
  );
}

export function pdfFilename(record) {
  const version = record.version ?? 1;
  return `${slugify(record.project_name)}-assessment-v${version}.pdf`;
}

export async function downloadAssessmentPdf(record) {
  const blob = await pdf(createElement(AssessmentPdf, { record })).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = pdfFilename(record);
  a.click();
  URL.revokeObjectURL(url);
}
