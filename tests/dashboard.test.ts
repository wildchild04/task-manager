import { createInMemoryServices, createServices } from "~/composition";

import { dashboardContract } from "./contract/dashboard.contract";

dashboardContract("memory", (options) => createInMemoryServices(options));
dashboardContract("sqlite", (options) => createServices(":memory:", options));
