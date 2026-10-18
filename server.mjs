/**
 * The production server: what `react-router-serve` does, plus trusting the
 * reverse proxy in front of it. Caddy terminates HTTPS and forwards plain HTTP
 * with `X-Forwarded-Proto: https`; without trusting it the app sees `http://`,
 * and React Router refuses every form post because the browser's `Origin` says
 * `https://`.
 *
 * Settings: PORT (default 3000), HOST, TRUST_PROXY (Express's `trust proxy`;
 * default: loopback and private networks, where Caddy and Docker connect from).
 */
import path from "node:path";
import url from "node:url";

import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";

const buildPath = path.resolve("build/server/index.js");
const build = await import(url.pathToFileURL(buildPath).href);
const clientDir = path.resolve("build/client");
const port = Number(process.env.PORT ?? 3000);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY ?? "loopback, uniquelocal");
app.use(compression());
// Fingerprinted assets never change; everything else in build/client is served as is.
app.use(path.posix.join(build.publicPath, "assets"), express.static(path.join(clientDir, "assets"), { immutable: true, maxAge: "1y" }));
app.use(build.publicPath, express.static(clientDir));
app.use(morgan("tiny"));
app.all("*splat", createRequestHandler({ build, mode: process.env.NODE_ENV ?? "production" }));

const server = process.env.HOST ? app.listen(port, process.env.HOST, ready) : app.listen(port, ready);
function ready() {
  console.log(`Listening on http://${process.env.HOST ?? "localhost"}:${port}${build.basename ?? ""}`);
}
for (const signal of ["SIGTERM", "SIGINT"]) process.once(signal, () => server.close(console.error));
