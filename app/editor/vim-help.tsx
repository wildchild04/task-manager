import { Dialog, Stack, Typography } from "@wildchild/design-system";

import { VIM_KEYS } from "~/editor/vim-keys";

/** The keys Vim mode handles, by group: opened with `?` in Normal mode or from the mode indicator. */
export function VimHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Vim mode keys" maxWidth="md" cancelAction={{ label: "Close", onClick: onClose }}>
      <Stack spacing={2}>
        {VIM_KEYS.map((group) => (
          <section key={group.title}>
            <Typography variant="overline" color="text.secondary">
              {group.title}
            </Typography>
            <table className="vim-keys">
              <tbody>
                {group.keys.map(([keys, meaning]) => (
                  <tr key={keys}>
                    <th scope="row">
                      {keys.split(" ").map((key, i) => (
                        <kbd key={i}>{key}</kbd>
                      ))}
                    </th>
                    <td>
                      <Typography variant="body2">{meaning}</Typography>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </Stack>
    </Dialog>
  );
}
