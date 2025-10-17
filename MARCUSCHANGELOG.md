# Marcus Changelog

This file documents local customizations so they can be re-applied or merged safely when upstream updates are pulled.

## Task Diagram Bootstrap (Windows-only)
- Added `DEFAULT_DIRECTORIES.IMAGES` constant and ensured `backlog/images` is created in `FileSystem.ensureBacklogStructure` (`src/constants/index.ts`, `src/file-system/operations.ts`).
- Introduced `DEFAULT_EXCALIDRAW_SVG`, `buildNotesBlock`, and `ensureTaskDiagram` helpers in `src/file-system/operations.ts`.
- New tasks/drafts now inject an `[Open in Code](vscode://file/...)` link at the top of Implementation Notes (even when notes are empty) so Windows users can open the Markdown file in VS Code with a single click.
- Updated `saveTask`/`saveDraft` to, on first save, create a matching `.excalidraw.svg` file and inject the diagram link before the existing VS Code link in Implementation Notes. The link uses a relative `../images/...` path.

## Global CLI Refresh Workflow
- After every change that affects the CLI, run `bun run build` and copy `dist/backlog.exe` to `node_modules/backlog.md-windows-x64/backlog.exe` so the globally linked `backlog` command stays current.

## Label Filtering in Web UI
- Added `LabelFilterDropdown` component (`src/web/components/LabelFilterDropdown.tsx`) with multi-select UI and normalization logic.
- Extended board (`src/web/components/Board.tsx`, `BoardPage.tsx`) and task list (`src/web/components/TaskList.tsx`) to support label filters alongside existing search and priority filters.
- `App.tsx` now aggregates labels from both `config.yml` (`config.labels`) and current tasks, exposing them to the board and task list.
- API client (`src/web/lib/api.ts`) includes `label` params when filtering; server (`src/server/index.ts`) parses `label`/`labels` query parameters; search service (`src/core/search-service.ts`) indexes and filters tasks by normalized labels.

## Notes
- A known upstream issue remains: `bunx tsc --noEmit` reports a missing `id` on a document mock in `src/test/core.test.ts`. This predates the customizations and has been left untouched.
