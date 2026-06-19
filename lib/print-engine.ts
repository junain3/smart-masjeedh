// FINAL PRINT DECISION ENGINE (DETERMINISTIC)
// Based on the agreed-upon rules from the architecture phase

export type PrintReportType =
  | "filtered-search-results"
  | "full-families-list"
  | "bulk-qr-codes"
  | "event-attendance"
  | "financial-collections"
  | "financial-pending-collections"
  | "financial-accounts"
  | "financial-salary"
  | "smart-members-report"
  | "other-simple-tabular";

export type PrintEngine = "browser-print" | "jspdf";

// FINAL DECISION RULES (STRICT, NO AMBIGUITY)
export function getPrintEngine(reportType: PrintReportType): PrintEngine {
  // FIRST CHECK: jsPDF TRIGGERS (TAKE PRECEDENCE)
  switch (reportType) {
    case "full-families-list":
    case "bulk-qr-codes":
    case "event-attendance":
    case "financial-collections":
    case "financial-pending-collections":
    case "financial-accounts":
    case "financial-salary":
      return "jspdf";

    // ELSE CHECK: Browser Print TRIGGERS
    case "filtered-search-results":
    case "smart-members-report":
    case "other-simple-tabular":
    default:
      return "browser-print";
  }
}

// FINAL BUTTON LABEL RULES
export function getPrintButtonLabel(
  reportType: PrintReportType,
  reportName: string
): string {
  const engine = getPrintEngine(reportType);
  return engine === "browser-print"
    ? `Print ${reportName}`
    : `Download ${reportName} PDF`;
}
