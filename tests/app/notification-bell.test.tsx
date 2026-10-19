import { DesignSystemProvider } from "@wildchild/design-system";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { NotificationBell } from "../../app/components/notification-bell";
import type { NotificationItem } from "../../app/lib/home.server";

function render(items: NotificationItem[]) {
  return renderToString(
    <MemoryRouter>
      <DesignSystemProvider mode="light">
        <NotificationBell items={items} />
      </DesignSystemProvider>
    </MemoryRouter>,
  );
}

describe("notification bell", () => {
  it("names the count and shows it on the badge", () => {
    const html = render([
      { id: "p", title: "Roadmap", detail: "2 suggestions · claude", href: "/pages/p" },
      { id: "c", title: "Water plants", detail: "Overdue", href: "/tasks/c" },
    ]);
    expect(html).toContain('aria-label="Notifications, 2"');
    expect(html).toMatch(/MuiBadge-badge[^"]*"[^>]*>2</);
    expect(html).not.toMatch(/class="MuiBadge-badge[^"]*MuiBadge-invisible/);
  });

  it("hides the badge with nothing to show", () => {
    const html = render([]);
    expect(html).toContain('aria-label="Notifications"');
    expect(html).toMatch(/class="MuiBadge-badge[^"]*MuiBadge-invisible/);
  });
});
