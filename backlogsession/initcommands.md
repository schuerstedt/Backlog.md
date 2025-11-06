# Initialization Commands

These commands are executed automatically after `bls init` completes successfully.

## Default Commands:

```bash
bls task create "On Session Start" --ac "git branch for session created" --ac "Session Goal template filled"
bls task create "On Session End" --ac "Chat history copied to session docs" --ac "Session summary written to session docs" --ac "git merged"
bls doc create "Session Goal"
bls doc create "Session User Notes"
bls browser
```
