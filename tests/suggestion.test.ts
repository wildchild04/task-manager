import { createInMemoryServices, createServices } from "~/composition";

import { actionSuggestionContract } from "./contract/action-suggestion.contract";
import { suggestionContract } from "./contract/suggestion.contract";

suggestionContract("memory", (options) => createInMemoryServices(options));
suggestionContract("sqlite", (options) => createServices(":memory:", options));

actionSuggestionContract("memory", (options) => createInMemoryServices(options));
actionSuggestionContract("sqlite", (options) => createServices(":memory:", options));
