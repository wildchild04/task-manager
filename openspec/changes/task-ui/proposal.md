## Why

The task overview (`/tasks/:taskId`) is read-only: a task can be created from its list but never moved through its lifecycle, commented on, or connected to anything from the browser. The domain already supports all of it (transitions with history, comments, references, lineage, chore urgency and series). This change makes the task page the place where work actually happens, and makes "everything can be the start of something" real: a cancelled work task, a done task or a comment can start an exploration or an update in one step.

## What Changes

- **Transitions** on the task page: one button per transition available from the current state, with dialogs where the transition takes input:
  - **promote** (exploration or update → work): the new work's title, defaulting to the idea's; the browser opens the new work
  - **return** (work): a required reason, posted as a comment, plus optional text appended to the task's description
  - **complete a chore**: "Create the following chore with the same configuration?" (yes by default when the chore repeats)
  - **cancel a repeating chore**: this occurrence or the whole series
  - start, pause, complete, cancel, reopen, tombstone and revive post directly
- **Chore urgency**: mark a to-do chore urgent, or back to normal. The configuration (base urgency, schedule) is unchanged.
- **History**: the task's transitions, newest first, with who did it (you or an agent by name), the note (e.g. a return reason) and when.
- **Comments** (work and chores): the flat list, oldest first, with author, time and an "edited" marker; adding, editing and deleting a comment. Comments are written as plain text; each paragraph of text becomes a paragraph block.
- **Lineage** (explorations, work, updates): the feature's tree from its root idea through every work and update, with the current task marked and every other task linked.
- **References**: what the task references (tasks, blocks, comments; deleted targets shown as missing), adding a reference to another task of the project, removing one; and "Referenced by": the tasks that reference this task.
- **Start from here**:
  - **Start exploration** from any task or any comment: creates an exploration referencing it and opens it
  - **Start update** from done work: creates an update iterating on it and opens it

## Capabilities

### New Capabilities
- `task-screen`: acting on a single task in the browser: transitions and their inputs, chore urgency, history, comments, lineage, references, and starting explorations and updates from a task or a comment.

### Modified Capabilities
- `project-screens`: the task overview is no longer read-only; its actions are specified in `task-screen`.

## Non-goals

- Editing a task's title or body content, and rich text in comments (bold, lists, references inside a comment): this waits for the block editor (keyboard spike). Editing a comment replaces its content with the new plain-text paragraphs.
- Referencing single blocks or library documents from the UI (needs a block picker); block references created through the domain are shown.
- Changing a chore's schedule after creation.
- Acting as an agent from the UI: every UI action is the human's. Agent workflows and their API are a separate change.
- Work logs, subtasks and a graveyard view.

## External dependencies

None. Everything uses existing `@wildchild/design-system` v0.4.0 components: `Button`, `Dialog`, `TextField` (multiline), `Checkbox`, `Radio`, `SearchSelect`, `Card`, `Chip`, `List`, `TreeNavigation`, `Alert`, `Link`, `Typography`, `Divider`.

## Prerequisites

- `task-core`, `task-comments`, `task-chore`, `project-ui` (applied and archived).

## Impact

- `app/routes/task.tsx` gains an action and the new sections; `app/lib/task-overview.server.ts` grows into the task screen's view builder, with action handlers in a new `app/lib/task-actions.server.ts`.
- `app/lib/page-view.server.ts` builds comment bodies with the same view model as pages.
- New components in `app/components/` (transition bar and dialogs, comment list and form, lineage, references).
- No domain or schema changes.
