import { createInMemoryServices, createServices } from "~/composition";

import { commentContract } from "./contract/comment.contract";

commentContract("memory", (options) => createInMemoryServices(options));
commentContract("sqlite", (options) => createServices(":memory:", options));
