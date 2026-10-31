## ADDED Requirements

### Requirement: The owner account
The app SHALL have at most one account, the owner's, identified by an email address (compared ignoring case; nothing is sent to it), with a password of at least 12 characters, stored only as a salted scrypt hash. While no account exists, every screen SHALL redirect to `/setup`, which offers "Create your account" (email, password, confirmation); creating it SHALL sign in and open home. Once an account exists, `/setup` SHALL redirect to `/login`, and creating another account SHALL be refused. Human actions SHALL still be recorded as `{ kind: "human" }`, meaning the owner; everything in the database before the account existed SHALL belong to the owner, with no data changed.

#### Scenario: First visit
- **WHEN** the app has no account and `/projects/abc` is opened
- **THEN** the browser is on `/setup`

#### Scenario: Create the account
- **WHEN** "owner@example.com" with a 14-character password, confirmed, is submitted on `/setup`
- **THEN** the account exists, the browser is signed in and on home, and every existing project, page and task is there as before

#### Scenario: Email ignoring case
- **WHEN** the account is "owner@example.com" and "Owner@Example.com" signs in with the right password
- **THEN** the session starts

#### Scenario: Short password
- **WHEN** a 6-character password is submitted on `/setup`
- **THEN** no account is created and the password field says it needs at least 12 characters

#### Scenario: Setup is closed afterwards
- **WHEN** an account exists and `/setup` is opened
- **THEN** the browser is on `/login`

### Requirement: Signing in and out
`/login` SHALL take the email and password; a wrong email or password SHALL say "Wrong email or password" and nothing more. From the fifth failure within 15 minutes, each further attempt SHALL be delayed (doubling from 1 second, at most 60) before it is checked; a success SHALL clear the failures. Signing in SHALL start a session held in an HTTP-only, `SameSite=Lax` cookie (`Secure` over HTTPS), scoped to the app's base path, and go to the `next` path it was sent from (only a path within the app) or home. A session SHALL end 30 days after it was last used, and SHALL be renewed while used. Signing out SHALL end the session and go to `/login`. Only a hash of the session's token SHALL be stored.

#### Scenario: Back to where I was
- **WHEN** a signed-out browser opens `/tasks/7a4ba67a`, then signs in
- **THEN** it is on `/tasks/7a4ba67a`

#### Scenario: Wrong password
- **WHEN** the password is wrong
- **THEN** the login page says "Wrong email or password" and no session starts

#### Scenario: Not somewhere else
- **WHEN** signing in from `/login?next=https://example.com/`
- **THEN** the browser goes home

#### Scenario: Sign out
- **WHEN** Sign out is chosen
- **THEN** the browser is on `/login`, and the old cookie no longer opens any screen

### Requirement: Everything requires signing in
Without a valid session, every route SHALL be refused except `/login`, `/setup` (while no account exists), the agent API (which has its own tokens) and static assets: screens and their data SHALL redirect to `/login?next=<path>`, and other `/api/*` routes and stored content (`/content/*`) SHALL be answered with status 401. A POST to the app's JSON routes whose `Origin` is another site SHALL be refused with status 403.

#### Scenario: Edits need a session
- **WHEN** `/api/edits` is posted without a session cookie
- **THEN** it is answered with status 401 and nothing changes

#### Scenario: Images need a session
- **WHEN** a stored image's `/content/:id` is requested without a session
- **THEN** it is answered with status 401

#### Scenario: Agents are let through to their own check
- **WHEN** an agent calls `/api/agent/projects` with its token and no cookie
- **THEN** it gets the projects

### Requirement: Changing the password
Settings SHALL let the owner change the password by giving the current one and the new one twice; a wrong current password, a mismatch or a short new password SHALL be refused with the reason next to the field. Changing it SHALL end every other session.

#### Scenario: Other browsers are signed out
- **WHEN** the password is changed in one browser while another is signed in
- **THEN** the other browser's next request goes to `/login`

### Requirement: Recovery from the command line
`npm run account password` (and `just account password`, on the homelab inside the container) SHALL set a new password, prompting for it twice without echo, creating the account (asking for the email) when there is none; it SHALL end every session. It SHALL work while the app is running.

#### Scenario: Locked out
- **WHEN** the owner forgot the password and runs `just account password` on the server
- **THEN** the new password signs in, and old sessions are gone
