import { Autosuggest } from "@wildchild/design-system";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

import type { GlobalSearchResult } from "../lib/page-search.server";
import { withBase } from "../lib/base-path";
import { useHydrated } from "../lib/use-hydrated";

/** Search all navigable workspace items without changing the mention picker. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const hydrated = useHydrated();
  const searchRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const value = query.trim();
    setResults([]);
    if (!value) {
      setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(withBase(`/api/search?q=${encodeURIComponent(value)}`), { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Search failed");
          return response.json() as Promise<{ results: GlobalSearchResult[] }>;
        })
        .then((data) => {
          if (!controller.signal.aborted) {
            setResults(data.results);
            setStatus("ready");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, attempt]);

  return (
    <div className="global-search">
      <Autosuggest
        ref={searchRef}
        label="Search workspace"
        placeholder="Search"
        size="small"
        disabled={!hydrated}
        value={query}
        onChange={setQuery}
        options={results.map((result) => ({
          value: result.href,
          label: result.title,
          description: `${result.place}${result.matchedId ? ` · ${result.matchedId}` : ""}`,
        }))}
        loading={status === "loading"}
        loadingText="Searching…"
        error={status === "error"}
        errorText="Search failed"
        onRetry={() => {
          setAttempt((value) => value + 1);
          searchRef.current?.querySelector("input")?.focus();
        }}
        noResultsText={query.trim() ? "No matches" : "Type to search"}
        clearOnSelect
        onSelect={(href) => {
          setResults([]);
          void navigate(href);
        }}
      />
    </div>
  );
}
