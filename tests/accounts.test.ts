import { createInMemoryServices, createServices } from "~/composition";

import { accountsContract } from "./contract/accounts.contract";

accountsContract("memory", (options) => createInMemoryServices(options));
accountsContract("sqlite", (options) => createServices(":memory:", options));
