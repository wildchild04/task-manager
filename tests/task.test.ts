import { createInMemoryServices, createServices } from "~/composition";

import { taskContract } from "./contract/task.contract";

taskContract("memory", (options) => createInMemoryServices(options));
taskContract("sqlite", (options) => createServices(":memory:", options));
