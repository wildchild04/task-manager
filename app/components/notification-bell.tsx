import { Badge, IconButton, Menu, Typography } from "@wildchild/design-system";
import { useState } from "react";
import { useNavigate } from "react-router";

import type { NotificationItem } from "../lib/home.server";

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
          icon="notifications"
          onClick={(event) => setAnchor(event.currentTarget)}
        />
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
