import { useEffect, useState } from "react";

/** False during the server render and the first browser render, true afterwards. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
