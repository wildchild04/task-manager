import { Badge, IconButton, Menu, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useNavigate } from "react-router";

import type { NotificationItem } from "../lib/home.server";

/** An outlined bell, until the design system's icon catalog has `notifications`. */
function BellIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6Z" />
    </svg>
  );
}

/** The top bar's bell: how many places need the human, and a menu that opens each. */
export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const count = items.length;
  const options =
    count === 0
      ? [{ value: "none", label: "Nothing needs you", disabled: true }]
      : items.map((item) => ({
          value: item.id,
          label: (
            <span className="notification-row">
              <Typography variant="body2">{item.title}</Typography>
              <Typography variant="caption" color="text.secondary">
                {item.detail}
              </Typography>
            </span>
          ),
          onClick: () => void navigate(item.href),
        }));

  return (
    <>
      <Badge content={count} color="error" invisible={count === 0} overlap="circular">
        <IconButton
          ariaLabel={count === 0 ? "Notifications" : `Notifications, ${count}`}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <BellIcon />
        </IconButton>
      </Badge>
      <Menu
        open={anchor !== null}
        anchorEl={anchor}
        options={options}
        onClose={() => setAnchor(null)}
        onSelect={() => setAnchor(null)}
      />
    </>
  );
}
