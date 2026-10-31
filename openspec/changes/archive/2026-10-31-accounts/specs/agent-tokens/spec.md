## ADDED Requirements

### Requirement: Registering agents
The owner SHALL register an agent by name (1 to 40 letters, digits, `-` or `_`) and receive its token once: `ntm_` followed by 32 random bytes in base64url. Only a hash of the token and its first 8 characters SHALL be stored. A name that already has an active token SHALL be refused. Registering SHALL also be possible from the command line (`npm run account agent <name>`, printing the token).

#### Scenario: Register claude
- **WHEN** "claude" is registered
- **THEN** a token starting with `ntm_` is shown once, and the agents list shows "claude" with that token's first characters and "never used"

#### Scenario: Name taken
- **WHEN** "claude" is registered again while its token is active
- **THEN** it is refused, saying "claude" already has a token

### Requirement: Revoking agents
The owner SHALL be able to revoke an agent's token, after a confirmation. A revoked token SHALL stop working at once, and its name SHALL be free to register again with a new token. The agents list SHALL show each active agent's name, token prefix, when it was registered and when its token was last used.

#### Scenario: Revoke
- **WHEN** "builder" is revoked
- **THEN** its next agent request is answered with status 401, and "builder" can be registered again

### Requirement: The settings page
`/settings` SHALL show the account (its email, changing the password) and the agents (the list, Register agent…, Revoke). After registering, a dialog SHALL show the token with a Copy button and the line to put in an MCP profile (`AGENT_TOKEN=<token>`), saying it won't be shown again.

#### Scenario: Copy the profile line
- **WHEN** "claude" is registered from Settings
- **THEN** the dialog shows `AGENT_TOKEN=ntm_…` with Copy, and closing it leaves no way to see the token again
