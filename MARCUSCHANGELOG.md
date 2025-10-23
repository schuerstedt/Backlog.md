# Marcus Changelog

This file documents local customizations so they can be re-applied or merged safely when upstream updates are pulled.

## 2025-10-23: Fixed Task Creation with Description Bug

### Problem
When creating a task with a description (via CLI or browser), the YAML frontmatter was being placed in the middle of the file instead of at the top. This caused markdown parsing to fail, resulting in missing task titles and metadata.

### Root Cause
The `updateStructuredSections` function in `src/markdown/structured-sections.ts` was not preserving the YAML frontmatter position when rebuilding file content. After `serializeTask` correctly placed frontmatter at the top, the Windows-specific code in `operations.ts` would call `updateStructuredSections` to add implementation notes, which would inadvertently move the frontmatter to the middle of the file.

### Solution
Modified `updateStructuredSections` in `src/markdown/structured-sections.ts`:
1. Extract and preserve the YAML frontmatter at the beginning (lines 197-203)
2. Process only the body content (everything after frontmatter)
3. Re-add the frontmatter at the top of the final output before returning (lines 247-252)

### Files Changed
- `src/markdown/structured-sections.ts` - Added frontmatter extraction and preservation logic with detailed MARCUS comments explaining the fix

### Testing Notes
- The bug only manifested in the compiled `backlog.exe`, not when running via `bun run cli`
- Be aware of Volta vs Bun PATH precedence issues (see MARCUSHOWTO.md troubleshooting section)
- After building, update the global installation: `Copy-Item .\dist\backlog.exe C:\Users\marcu\.bun\bin\backlog.exe -Force`

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
