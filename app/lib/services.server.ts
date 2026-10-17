import { type AppServices, createServices } from "~/composition";

declare global {
  var __services: AppServices | undefined;
}

/**
 * The domain services for loaders and actions. Created once per process; in
 * development it survives hot reloads so there is a single SQLite connection.
 */
export const services: AppServices = globalThis.__services ?? createServices();

if (process.env.NODE_ENV !== "production") globalThis.__services = services;
