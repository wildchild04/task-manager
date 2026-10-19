import { createServices } from "~/composition";

import { convertLiteralTables } from "./literal-tables";

/**
 * Converts tables stored as literal `|` paragraphs into table blocks.
 * A dry run by default; `--apply` converts. Back up the database first.
 */
const apply = process.argv.includes("--apply");
const services = createServices();
try {
  const report = convertLiteralTables(services, { apply });
  for (const page of report.pages) console.log(`${page.title}: ${page.tables} ${page.tables === 1 ? "table" : "tables"}`);
  console.log(
    report.tables === 0
      ? "No literal tables found."
      : apply
        ? `Converted ${report.tables} tables on ${report.pages.length} pages.`
        : `Dry run: ${report.tables} tables on ${report.pages.length} pages would be converted. Run with --apply to convert.`,
  );
} finally {
  services.close();
}
