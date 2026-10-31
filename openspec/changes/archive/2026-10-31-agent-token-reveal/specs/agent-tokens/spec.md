## MODIFIED Requirements

### Requirement: Registering agents
The owner SHALL register an agent by name (1 to 40 letters, digits, `-` or `_`) and receive its token: `ntm_` followed by 32 random bytes in base64url. A hash of the token and its first 8 characters SHALL be stored, and, when `SECRET_KEY` is set, the token encrypted with AES-256-GCM under a key derived from it (the agent's ID bound as additional data); requests SHALL be checked against the hash only. A `SECRET_KEY` shorter than 32 characters SHALL stop the app from starting, naming the setting. A name that already has an active token SHALL be refused. Registering SHALL also be possible from the command line (`npm run account agent <name>`, printing the token).

#### Scenario: Register claude
- **WHEN** "claude" is registered
- **THEN** a token starting with `ntm_` is shown, and the agents list shows "claude" with that token's first characters and "never used"

#### Scenario: Encrypted at rest
- **WHEN** "claude" is registered with `SECRET_KEY` set
- **THEN** the database holds the token's hash and an encrypted copy, and not the token itself

#### Scenario: Name taken
- **WHEN** "claude" is registered again while its token is active
- **THEN** it is refused, saying "claude" already has a token

## ADDED Requirements

### Requirement: Showing a token again
Settings SHALL offer **Show token…** for each agent whose token was kept; it SHALL ask for the owner's password and then show the token as after registering (Copy, the `AGENT_TOKEN=` line). A wrong password SHALL show nothing and count toward the sign-in throttle. An agent whose token wasn't kept (registered before, or without `SECRET_KEY`) SHALL say so instead, suggesting to revoke and register again. A token that can't be decrypted with the current key SHALL say so; the agent SHALL keep working. `npm run account token <name>` SHALL print a kept token.

#### Scenario: Show claude's token
- **WHEN** Show token… is chosen for "claude" and the right password given
- **THEN** the dialog shows the same `AGENT_TOKEN=ntm_…` line as when it was registered

#### Scenario: Wrong password
- **WHEN** Show token… is given a wrong password
- **THEN** the dialog says "Wrong password" and shows no token

#### Scenario: Registered before
- **WHEN** an agent was registered before tokens were kept
- **THEN** Settings shows no Show token… for it and says to register it again to be able to show it

#### Scenario: Key changed
- **WHEN** `SECRET_KEY` changed since "claude" was registered
- **THEN** Show token says the token can't be read with the current key, and claude's requests still succeed
