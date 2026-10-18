## Decisions

### 1. Deletion runs in the project service, in one unit of work
`ProjectService.delete(id)` loads the project's tasks and, inside `uow.run`: deletes each task's comments (comment rows and their body blocks), each task's body page, then the task (`TaskRepository.delete` removes its transition history and its outgoing relations), then the home page and library root blocks (which cascade to everything under them), then the project row. Block deletions pass `bypassProtectionFor: ["project", "task", "comment"]`: those hooks exist to stop ordinary edits from removing owned roots, and this is the owning domain removing them. The unit of work rolls everything back on any failure.

### 2. Dangling pointers resolve as missing
Incoming relations from other projects' tasks and mentions in other pages are not touched: relation targets and mentions already resolve to "missing" when their target is gone. Only relations *from* deleted tasks are removed (they belong to the task).

### 3. The screen
The project home's loader adds what deleting involves (`{ title, tasks, documents }`). The delete button (the design system's `IconButton` with the `delete` icon) sits at the top right next to the title, like a page's; the dialog posts `intent=delete-project` to the project route, whose action deletes and redirects to `/`.
