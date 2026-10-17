## 1. Projects (before task-core)

- [ ] 1.1 Confirm `block-data-model` is applied, including owned roots and the protection hook
- [ ] 1.2 Define `Project` and the `ProjectRepository` interface (create, get, list) in `src/domain/projects/`
- [ ] 1.3 Write the `projects` migration (numbered after blocks, before tasks)
- [ ] 1.4 Implement `ProjectService.create`: project row, home page and library root (owned roots `project:<id>`) in one unit of work
- [ ] 1.5 Register the `project` owner kind with the block protection hook (roots editable, not deletable)
- [ ] 1.6 Implement title reads through the home page and project listing in creation order
- [ ] 1.7 Write the contract suite for the project spec and pass it with the in-memory and SQLite implementations

## 2. Knowledge library (before task-core)

- [ ] 2.1 Implement `getLibraryTree(projectId)`: page-only tree at every depth, in sibling order
- [ ] 2.2 Implement `projectOfPage(pageId)`: walk to the root and read its owner (project directly, or the task's project once `task-core` exists)
- [ ] 2.3 Test document create, nest, reorder, delete-with-children, and move to another project's library with references still resolving

## 3. Dashboard (after task-core)

- [ ] 3.1 Define the `DashboardSection` interface and the ordered section registry
- [ ] 3.2 Implement the six sections: work-in-progress, returned-work, open-explorations, open-updates, chores, library
- [ ] 3.3 Add the `task_transitions (task_id, at)` index if `task-core` didn't, and implement the returned-work query
- [ ] 3.4 Implement `getDashboard(projectId, limit = 5)` returning every section with count and items, including empty ones
- [ ] 3.5 Test every scenario in the project-dashboard spec with both repository implementations
- [ ] 3.6 Confirm `typecheck` and the full test suite pass
