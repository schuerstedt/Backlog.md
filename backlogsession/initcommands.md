# Initialization Commands

These commands are executed automatically after `bls init` completes successfully.

## Default Commands:

```bash
bls task create "On Session Start" \
    --ac "git branch for session created" \
    --ac "Session Goal doc filled" \
    --ac "UAT Session Goal doc" \
    --ac "Check for and migrate uncompleted tasks from previous sessions using `bls task list --plain --latest`" \
    --ac "Create default TODO.md, LABELS.md, and OUTPUTTEMPLATE.md" \
    -s "Approved"

bls task create "On Session End" \
    --ac "Chat history completely logged to doc 4 - Session Chat Log" \
    --ac "Session summary written to doc 3 - Session Summary" \
    --ac "Commit all changes made during the session to the session's git branch" \
    --ac "Merge the session branch back into the main branch" \
    --ac "Clean up temporary files and directories" \
    --ac "Archive completed tasks and relevant documentation" \
    --ac "Update global BACKLOGSESSION-INSTRUCTIONS.md with new insights" \
    --ac "Update global AGENTS.md with agent-specific improvements" \
    --ac "Update global initcommands.md with new initialization steps" \
    -s "Approved"

bls doc create "Session Goal"
bls doc create "Session User Notes"
bls doc create "Session Summary"
bls doc create "Session Chat Log"
bls doc create "TODO"
bls doc create "LABELS"
bls doc create "OUTPUTTEMPLATE"
```
