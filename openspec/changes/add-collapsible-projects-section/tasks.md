# Tasks — Add Collapsible Projects Section

- [x] Add a persisted `projectsCollapsed` flag to the store (`types`, `core`,
      `autosave`, `persistence`) defaulting to expanded.
- [x] Add a `toggleProjectsCollapsed` store helper and export it.
- [x] Make the Projects section header a toggle with a chevron indicator, and
      hide the project list when collapsed.
- [x] Cover the persisted flag in the persistence test suite.
- [x] Validate with `npm run typecheck`, `npm test`, and
      `openspec validate --all --strict`.
