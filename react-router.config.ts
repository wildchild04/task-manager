import type { Config } from "@react-router/dev/config";

import { appBasePath } from "./app-base-path";

export default {
  ssr: true,
  basename: appBasePath(),
} satisfies Config;
