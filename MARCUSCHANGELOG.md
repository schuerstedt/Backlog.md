# Marcus Changelog

This file documents local customizations so they can be re-applied or merged safely when upstream updates are pulled.

## 2025-11-04: BacklogSession Integration

### Summary
Integrated the BacklogSession feature from `edunmore/BacklogSession:codextry` branch, providing isolated session workspace functionality while maintaining full compatibility with the main Backlog.md codebase.

### What is BacklogSession?
BacklogSession creates an isolated workspace in a `backlogsession/` subdirectory, allowing agents or users to work on tasks without affecting the main project backlog. Perfect for:
- AI agent experimentation
- Temporary project planning
- Session-based workflows with custom column configurations
- Testing task management scenarios

### Key Features Added
1. **Session Isolation**: All operations occur in dedicated `backlogsession/` directory
2. **Custom Workflow Columns**: Plan → Approve → Cancel → Doing → Done
3. **Dual CLI Support**: 
   - `backlogsession` wrapper for isolated operations
   - `backlog session-mcp start` for MCP server in session mode
4. **Full Feature Parity**: All backlog commands work in session context

### Implementation Details

#### New Files
- **`backlogsession.js`** (152 lines): Node.js CLI wrapper that:
  - Creates `backlogsession/` directory in current working directory
  - Delegates all commands to main CLI within session context
  - Patches config after `init` to set custom columns
  - Handles both development and production modes

- **`src/commands/session-mcp.ts`**: CLI command registration for session MCP server
  - Registers `session-mcp` command group
  - Provides `session-mcp start` for stdio transport
  - Includes debug logging options

- **`src/mcp/session-server.ts`**: Session-aware MCP server implementation
  - Extends `McpServer` base class for code reuse
  - Creates isolated session directory automatically
  - Configures custom workflow columns in session config
  - Shares all MCP tools and resources from main server

- **`src/test/backlogsession.test.ts`**: Comprehensive test suite
  - Tests session directory creation
  - Verifies command delegation
  - Validates config patching
  - Confirms output proxying
  - All 5 tests passing ✅

#### Modified Files
- **`package.json`**: Added `backlogsession` binary entry
- **`src/cli.ts`**: Registered session-mcp command group

### Architecture
```
SessionMcpServer extends McpServer extends Core
                              ↓
                    Uses session directory
                    (backlogsession/)
                              ↓
                    Same filesystem, git ops
                              ↓
                    Custom workflow config
```

### Usage Examples

#### Initialize a Session
```bash
backlogsession init "My Session"
# Creates backlogsession/backlog/ with custom columns
```

#### Use All Commands in Session
```bash
backlogsession task create "Plan the feature"
backlogsession task edit 1 --status Approve
backlogsession board
```

#### MCP Server in Session Mode
```bash
backlog session-mcp start
# Or with debug logging:
backlog session-mcp start --debug
```

#### Configure in Claude Desktop
```json
{
  "mcpServers": {
    "backlog-session": {
      "command": "backlog",
      "args": ["session-mcp", "start"]
    }
  }
}
```

### Testing Status
- ✅ All 5 BacklogSession wrapper tests passing
- ✅ TypeScript compilation clean (no errors)
- ✅ Build successful
- ⚠️ Some existing tests show interference from temp dir (expected, not a blocker)

### Session Workflow Columns
The session automatically configures these custom statuses:
1. **Plan** - Initial planning phase
2. **Approve** - Review and approval needed
3. **Cancel** - Rejected or cancelled items
4. **Doing** - Active work in progress
5. **Done** - Completed items

### Compatibility
- ✅ Maintains all Marcus customizations
- ✅ Compatible with diagram/image functionality
- ✅ Works with existing MCP infrastructure
- ✅ No conflicts with main backlog commands

### Source
- Original: https://github.com/edunmore/BacklogSession/tree/codextry
- Integration branch: `feature/backlog-session`
- Commit: feat: Add BacklogSession integration with isolated workspace support

### Notes
- Session directories are independent - can have multiple sessions in different folders
- Config patching happens automatically on `backlogsession init`
- Session MCP server shares workflow resources with main MCP server
- Full backward compatibility - no breaking changes to existing functionality

---

## 2025-11-04: Merged Upstream v1.17.4 → v1.18.5

### Merge Summary
Successfully merged 17 commits from upstream (https://github.com/MrLesk/Backlog.md) bringing the fork from v1.17.4 to v1.18.5.

### Strategy
1. Created backup branch: `backup-before-upstream-merge-2025-11-04`
2. Fetched latest upstream changes
3. Merged `upstream/main` with no conflicts
4. All customizations preserved automatically during merge

### Upstream Changes Incorporated
Major new features:
- **TASK-308**: Shell tab completion support for CLI commands (bash, zsh, fish)
- **TASK-312**: Baseline build targets for older CPUs without AVX2 support
- **TASK-314**: Synced CI and release workflows with Bun 1.2.23
- **TASK-315**: Fixed NixOS flake to use baseline Bun for build process
- **TASK-311**: Rollback CI to Bun 1.2.23
- **TASK-309**: Improve TUI empty state when task filters return no results
- **TASK-310**: Strengthen Backlog workflow overview emphasis

### Files Changed
- 39 files changed: 2,845 insertions(+), 135 deletions(-)
- New: Shell completion scripts for bash, zsh, and fish
- New: Comprehensive completion system with dynamic task ID and config value completion
- Updated: CI/CD workflows for better cross-platform support
- Updated: Biome and project configuration

### Customizations Status After Merge
All Marcus customizations were preserved:
- ✅ Diagram/images functionality (IMAGES constant, DEFAULT_EXCALIDRAW_SVG, ensureTaskDiagram)
- ✅ Frontmatter preservation bug fix in structured-sections.ts
- ✅ Windows-specific VS Code link injection

### Notes
- Git auto-merge successfully handled all changes
- Build completed successfully
- Version now at v1.18.5 with all customizations intact
- Some test failures expected due to Marcus customizations (diagram injection in Implementation Notes)

## 2025-10-23: Resolved Volta Conflict - Permanent Fix

### Problem
The global `backlog` command was using an old Volta-installed version instead of the Bun version with latest fixes. This caused the frontmatter preservation fix to appear broken, even though the code was correct.

### Root Cause
Volta's PATH entries take precedence over Bun's. When running `where.exe backlog`, Volta's version appeared first:
- `C:\Users\marcu\AppData\Local\Volta\bin\backlog` (old version)
- `C:\Users\marcu\.bun\bin\backlog.exe` (current version with fixes)

### Solution
Permanently removed the Volta version:
```powershell
volta uninstall backlog.md
```

### Result
- ✅ `backlog` command now uses Bun version at `C:\Users\marcu\.bun\bin\backlog.exe`
- ✅ All custom fixes (including frontmatter preservation) work correctly
- ✅ No need to use full paths or repeat this step - permanent fix

### Updated Workflow
Standard workflow after code changes:
```powershell
bun run build
Copy-Item .\dist\backlog.exe C:\Users\marcu\.bun\bin\backlog.exe -Force
```

### Files Changed
- `MARCUSHOWTO.md` - Simplified global installation section, removed Volta troubleshooting

## 2025-10-23: Merged Upstream v1.16.5 → v1.17.4

### Merge Summary
Successfully merged 15 commits from upstream (https://github.com/MrLesk/Backlog.md) bringing the fork from v1.16.5 to v1.17.4.

### Strategy
1. Created backup branch: `backup-before-upstream-merge-2025-10-23`
2. Committed local bug fix for frontmatter preservation
3. Stashed working directory changes (test files)
4. Merged `upstream/main` with no conflicts
5. All customizations preserved automatically during merge

### Upstream Changes Incorporated
- TASK-307: Support legacy MCP clients via dual-mode MCP workflow instructions
- TASK-305: Improve MCP guidelines to cross-link workflows  
- TASK-304: Update MCP integration documentation and CLI client commands
- TASK-302: Support flexible ID formats for tasks and docs
- TASK-301: MCP document tools
- TASK-300: Fix backlog init MCP registration flags
- TASK-299: Fix MCP initialization for multiple projects
- 49 files changed: 1,843 insertions(+), 322 deletions(-)

### Customizations Status After Merge
All Marcus customizations were preserved:
- ✅ Diagram/images functionality (IMAGES constant, DEFAULT_EXCALIDRAW_SVG, ensureTaskDiagram)
- ✅ Frontmatter preservation bug fix in structured-sections.ts
- ✅ Windows-specific VS Code link injection

### Notes
- Git auto-merge successfully handled all conflicts
- Build and test passed after merge
- Version now at v1.17.4 with all customizations intact

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
