---
id: task-1
title: Add auto-initialization commands to bls init
status: Done
assignee: []
created_date: '2025-11-06 13:05'
updated_date: '2025-11-06 13:32'
labels: []
dependencies: []
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create initcommands.md template file if not exists in backlogsession/ folder
- [x] #2 Default commands create task #1 'On Session Start' with AC: 'git branch for session created' and 'Session Goal template filled'
- [x] #3 Default commands create task #2 'On Session End' with AC: 'Chat history copied to session docs', 'Session summary written to session docs', and 'git merged'
- [x] #4 Default commands create 'Session Goal' document (no -t flag)
- [x] #5 Default commands create 'Session User Notes' document (no -t flag)
- [x] #6 Default commands start browser with 'bls browser'
- [x] #7 Execute commands from initcommands.md after successful bls init
- [x] #8 All commands execute in session directory context
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
this must happen after the backlog init and config changes are completed
<!-- SECTION:NOTES:END -->
