import { createInMemoryServices, createServices } from "~/composition";

import { suggestionContract } from "./contract/suggestion.contract";

suggestionContract("memory", (options) => createInMemoryServices(options));
suggestionContract("sqlite", (options) => createServices(":memory:", options));
