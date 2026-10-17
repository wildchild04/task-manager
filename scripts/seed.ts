import { createServices } from "~/composition";

import { seed } from "./seed-data";

const services = createServices();
try {
  const added = seed(services);
  console.log(added.pages ? "Seeded the Welcome and Block showcase pages." : "Sample pages already exist.");
  console.log(added.project ? "Seeded the sample project." : "Sample project already exists.");
} finally {
  services.close();
}
