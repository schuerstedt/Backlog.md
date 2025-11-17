# Initialization Commands

These commands are executed automatically after `bls init` completes successfully. 

IMPORTANT: these commands are for regular BLS usage only - no retro work must be spcified here. 

## Default Commands:

```bash
bls task create "On Session Start" \
    --ac "git branch for session created" \
    --ac "Session Goal doc filled" \
    --ac "Check for and migrate uncompleted tasks from previous sessions using `bls task list --plain --latest`" \
    --ac "Get approval from user if Session Goal doc is OK" \
    -s "Approved"

bls task create "On Session End" \
    --ac "FULL Chat history with all details logged to doc 4 - Session Chat Log" \
    --ac "Session summary written to doc 3 - Session Summary" \
    --ac "Commit all changes made during the session to the session's git branch" \
    --ac "Merge the session branch back into the main branch" \
    --ac "Clean up temporary files and directories" \
    --ac "Archive completed tasks and relevant documentation" \
    --ac "Get approval from user if all ACs are met" \
    --notes "When editing doc files make sure the front matter is intact!"\
    -s "Approved"

bls doc create "Session Goal"
bls doc create "Session User Notes"
bls doc create "Session Summary"
bls doc create "Session Chat Log"
```
