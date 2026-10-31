import { Button, Icon, Menu } from "@wildchild/design-system";
import { useState } from "react";
import { useFetcher, useNavigate } from "react-router";

/** The signed-in account in the top bar, with Settings and Sign out. */
export function AccountMenu({ email }: { email: string }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const fetcher = useFetcher();
  return (
    <>
      <Button
        variant="text"
        ariaLabel={`Account: ${email}`}
        endIcon={<Icon name="chevron_down" size="small" />}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <span className="account-email">{email}</span>
      </Button>
      <Menu
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        options={[
          { value: "settings", label: "Settings" },
          { value: "logout", label: "Sign out" },
        ]}
        onSelect={(value) => {
          setAnchor(null);
          if (value === "settings") void navigate("/settings");
          else void fetcher.submit(null, { method: "post", action: "/logout" });
        }}
      />
    </>
  );
}
