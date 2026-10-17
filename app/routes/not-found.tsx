import { data } from "react-router";

import { NotFound } from "../components/not-found";

export function loader() {
  return data(null, { status: 404 });
}

export function meta() {
  return [{ title: "Not found" }];
}

export default function NotFoundRoute() {
  return <NotFound />;
}
