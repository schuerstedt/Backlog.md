# Marcus Hot-Take / Setup Notes

Quick reference for enabling custom Backlog.md features on a new machine.

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

3. Ensure Volta isn’t holding a global `backlog.md` binary. Remove it if present:
   ```powershell
   volta uninstall backlog.md
   ```
   If the Volta package directory persists (`%LOCALAPPDATA%\Volta\tools\image\packages\backlog.md`), remove it manually (may require `takeown`/`icacls` to access).

## Global CLI Linking
1. From the repository root (`F:\Backlog.md` in our setup) run:
   ```powershell
   npm link --ignore-scripts
   ```
   This exposes the CLI globally through Node/Volta.

2. Build the CLI and copy the executable into the platform shim so the linked command uses the local code:
   ```powershell
   bun run build
   Copy-Item -Force dist\backlog.exe node_modules\backlog.md-windows-x64\backlog.exe
   ```
   Repeat these two commands after any code change that should propagate globally.

3. Verify the global shim:
   ```powershell
   backlog --version      # should reflect repo version (e.g., 1.16.5)
   where backlog          # should point into Volta’s shim directory
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
- If `Copy-Item` fails because `backlog.exe` is in use, stop any running processes:
  ```powershell
  Get-Process | Where-Object { $_.Path -like '*backlog.exe*' } | Stop-Process -Force
  ```
  Then re-copy the binary.

- `bunx tsc --noEmit` currently fails on upstream test fixtures missing a required `id` in `src/test/core.test.ts`. This is a known issue unrelated to the custom changes. You can ignore for now or patch upstream tests if needed.
