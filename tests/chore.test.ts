import { createInMemoryServices, createServices } from "~/composition";

import { choreContract } from "./contract/chore.contract";

choreContract("memory", (options) => createInMemoryServices(options));
choreContract("sqlite", (options) => createServices(":memory:", options));
