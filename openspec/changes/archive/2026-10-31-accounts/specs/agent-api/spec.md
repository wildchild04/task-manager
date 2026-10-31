## MODIFIED Requirements

### Requirement: Agent authentication and identity
Every request to `/api/agent/*` SHALL carry `Authorization: Bearer <token>` with the token of a registered agent that isn't revoked (see agent-tokens), and SHALL act as that agent's name; `X-Agent-Name` SHALL be ignored. A missing, unknown or revoked token SHALL be answered with status 401 (code `unauthorized`), saying to register the agent in Settings and use its token. Every change an agent makes SHALL be recorded with the actor `{ kind: "agent", name }`, its name taken from its token.

#### Scenario: Wrong token
- **WHEN** a request is made with a token that isn't registered
- **THEN** it is answered with status 401 and nothing changes

#### Scenario: The token names the agent
- **WHEN** the agent registered as "builder" starts a work task while sending `X-Agent-Name: reviewer`
- **THEN** the task's history shows the start by "builder"

#### Scenario: Revoked token
- **WHEN** an agent's token was revoked
- **THEN** its requests are answered with status 401

#### Scenario: API off
- **WHEN** no agent is registered
- **THEN** every agent request is answered with status 401

#### Scenario: Acting as the agent
- **WHEN** the agent "builder" starts a work task
- **THEN** the task's history shows the start by "builder"
