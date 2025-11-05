# Marcus Hot-Take / Setup Notes

Quick reference for enabling custom Backlog.md features on a new machine.

## ⚠️ CRITICAL: ALWAYS UPDATE MARCUSCHANGELOG.md
**Whenever you make changes to the codebase, ALWAYS document them in `MARCUSCHANGELOG.md`!**
This is essential for tracking what has been modified and why.

## Prerequisites
1. Install Bun via PowerShell:
   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   irm https://bun.sh/install.ps1 | iex
   ```
   After installation Bun lives at `%USERPROFILE%\.bun\bin`. Optionally add that to `PATH`.

2. Install repo dependencies without running postinstall scripts (the upstream postinstall currently assumes `sh`):
   ```powershell
   npm install --ignore-scripts
   ```

## Making Changes Available Globally

⚠️ **IMPORTANT FOR UAT**: After making ANY code changes, you MUST deploy the new build globally for User Acceptance Testing!

### Build and Deploy Steps:
1. Build the project:
   ```powershell
   bun run build
   ```

2. **If backlog is currently running** (browser server, etc.), stop all backlog processes first:
   - Close any browser windows running the backlog server
   - Kill any terminal processes running backlog commands
   - Wait a few seconds for the file lock to release

3. Copy the new executable to global location:
   ```powershell
   Copy-Item .\dist\backlog.exe C:\Users\marcu\.bun\bin\backlog.exe -Force
   ```

**Repeat these steps after ANY code change that needs UAT!**

**Common Issue**: If you get "process cannot access the file", it means backlog.exe is still running. Close all backlog processes and wait before retrying the copy command.

**Note**: Verify the correct executable is being used:
```powershell
where.exe backlog      # Should show C:\Users\marcu\.bun\bin\backlog.exe first
backlog --version      # Should reflect repo version (e.g., 1.17.4)
```

## Testing Latest Changes
1. Launch the browser UI to confirm label filters and diagram links:
   ```powershell
   backlog browser
   ```
   Open the displayed URL, go to the board/list views, and exercise the “Filter labels” dropdown.

2. Create a task to confirm the diagram automation:
   ```powershell
   backlog task create "Check Diagram" --notes "Test notes"
   ```
   Ensure `backlog/images/task-XXX - Check-Diagram.excalidraw.svg` exists and the task markdown contains the image plus VS Code link at the top of Implementation Notes.

## Updating on Another Machine
1. `git clone` your fork (which contains the customizations).
2. Follow the prerequisites and global linking steps above.
3. When pulling upstream changes, consult `MARCUSCHANGELOG.md` to reapply custom patches as needed; rebuild/copy the binary afterward.

## Troubleshooting

### General Issues
- If `Copy-Item` fails because `backlog.exe` is in use, stop any running processes:
  ```powershell
  Get-Process | Where-Object { $_.Path -like '*backlog.exe*' } | Stop-Process -Force
  ```
  Then re-copy the binary.

- `bunx tsc --noEmit` currently fails on upstream test fixtures missing a required `id` in `src/test/core.test.ts`. This is a known issue unrelated to the custom changes. You can ignore for now or patch upstream tests if needed.
