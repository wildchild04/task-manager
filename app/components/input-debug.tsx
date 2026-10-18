import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

const EVENTS = ["keydown", "beforeinput", "input", "compositionstart", "compositionupdate", "compositionend"] as const;

/**
 * Temporary: with `?debug-input` in the URL, lists the last keyboard and input
 * events at the bottom of the screen, for debugging input on devices without
 * developer tools (the iPad slash menu).
 */
export function InputDebug() {
  const [searchParams] = useSearchParams();
  const enabled = searchParams.has("debug-input");
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const log = (event: Event) => {
      const e = event as Partial<InputEvent & KeyboardEvent & CompositionEvent>;
      const parts = [
        event.type,
        e.inputType,
        e.key !== undefined ? `key=${JSON.stringify(e.key)}` : undefined,
        e.data !== undefined && e.data !== null ? `data=${JSON.stringify(e.data)}` : undefined,
        e.isComposing ? "composing" : undefined,
        event.defaultPrevented ? "prevented" : undefined,
      ];
      setLines((current) => [...current.slice(-11), parts.filter(Boolean).join(" ")]);
    };
    // Bubbling, so `prevented` shows what the editor did with the event.
    for (const type of EVENTS) document.addEventListener(type, log);
    return () => {
      for (const type of EVENTS) document.removeEventListener(type, log);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <pre
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        zIndex: 2000,
        margin: 0,
        padding: 8,
        maxHeight: "40vh",
        overflow: "auto",
        font: "12px/1.4 monospace",
        background: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        borderRadius: 8,
        pointerEvents: "none",
      }}
    >
      {lines.join("\n") || "Type in the editor…"}
    </pre>
  );
}
