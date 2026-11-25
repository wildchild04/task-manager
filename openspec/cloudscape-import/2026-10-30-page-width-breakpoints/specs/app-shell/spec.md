## MODIFIED Requirements

### Requirement: Design system and theme
The app SHALL be built with Cloudscape: its components, global styles and design tokens. Document text (pages, task bodies, comments, in the editor and read-only alike) SHALL use the app's document typography, coloured with Cloudscape tokens. On pages, the document column SHALL be at most 760px wide, widening on wider windows: at most 920px from a 1600px window, 1080px from 2200px and 1240px from 2800px. The theme mode (light or dark) SHALL be kept in a cookie and read by the root loader, so the server renders the chosen mode (Cloudscape's dark-mode class on the body) and there is no flash of the other mode. A theme control in the shell SHALL switch the mode.

#### Scenario: Mode survives reload
- **WHEN** dark mode is selected and the page is reloaded
- **THEN** the server-rendered page is already in dark mode

#### Scenario: Floating menus follow the mode
- **WHEN** dark mode is on and the slash menu opens in a page
- **THEN** the menu uses Cloudscape's dark dropdown colours

#### Scenario: Wider page column on a 4K monitor
- **WHEN** a page is opened in a 1280px window and then in a 2560px one
- **THEN** its document column is 760px wide in the first and 1080px wide in the second
