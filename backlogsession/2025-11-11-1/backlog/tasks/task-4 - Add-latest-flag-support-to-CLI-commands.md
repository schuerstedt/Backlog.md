---
id: task-4
title: Add --latest flag support to CLI commands
status: Done
assignee: []
created_date: '2025-11-11 10:20'
updated_date: '2025-11-11 10:36'
labels: []
dependencies: []
ordinal: 2000
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add --latest flag option to all commands except init
- [x] #2 Flag detection works correctly in command parser
- [x] #3 Auto-trigger bls init if no session exists for today when --latest is used
- [x] #4 Commands with --latest flag are re-executed in previous session directory
- [ ] #5 UAT: Test --latest flag with various commands
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC-4 without --latest flag
<!-- SECTION:NOTES:END -->
