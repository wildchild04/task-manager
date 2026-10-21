import { type AppServices, createServices } from "~/composition";

import { BASE_PATH } from "./base-path";

declare global {
  var __services: AppServices | undefined;
}

/**
 * The domain services for loaders and actions. Created once per process; in
 * development it survives hot reloads so there is a single SQLite connection.
 */
export const services: AppServices = globalThis.__services ??
  createServices(undefined, { timeZone: process.env.TIME_ZONE || undefined, basePath: BASE_PATH });

if (process.env.NODE_ENV !== "production") globalThis.__services = services;
