import { createInMemoryServices, createServices } from "~/composition";

import { projectContract } from "./contract/project.contract";

projectContract("memory", (options) => createInMemoryServices(options));
projectContract("sqlite", (options) => createServices(":memory:", options));
