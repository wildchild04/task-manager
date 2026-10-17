## 1. Projects (before task-core)

- [x] 1.1 Confirm `block-data-model` is applied, including owned roots and the protection hook
- [x] 1.2 Define `Project` and the `ProjectRepository` interface (create, get, list) in `src/domain/projects/`
- [x] 1.3 Write the `projects` migration (numbered after blocks, before tasks)
- [x] 1.4 Implement `ProjectService.create`: project row, home page and library root (owned roots `project:<id>`) in one unit of work
- [x] 1.5 Register the `project` owner kind with the block protection hook (roots editable, not deletable)
- [x] 1.6 Implement title reads through the home page and project listing in creation order
- [x] 1.7 Write the contract suite for the project spec and pass it with the in-memory and SQLite implementations

## 2. Knowledge library (before task-core)

- [x] 2.1 Implement `getLibraryTree(projectId)`: page-only tree at every depth, in sibling order
- [x] 2.2 Implement `projectOfPage(pageId)`: walk to the root and read its owner (project directly, or the task's project once `task-core` exists)
- [x] 2.3 Test document create, nest, reorder, delete-with-children, and move to another project's library with references still resolving

## 3. Dashboard (after task-core)

- [x] 3.1 Define the `DashboardSection` interface and the ordered section registry
- [x] 3.2 Implement the six sections: work-in-progress, returned-work, open-explorations, open-updates, chores, library
- [x] 3.3 Rely on `task-core`'s `task_transitions (task_id, at)` index and implement the returned-work section (see design 6)
- [x] 3.4 Implement `getDashboard(projectId, limit = 5)` returning every section with count and items, including empty ones
- [x] 3.5 Test every scenario in the project-dashboard spec with both repository implementations
- [x] 3.6 Confirm `typecheck` and the full test suite pass
