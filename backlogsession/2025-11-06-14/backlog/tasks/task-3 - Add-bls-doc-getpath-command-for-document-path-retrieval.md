---
id: task-3
title: Add bls doc getpath command for document path retrieval
status: Done
assignee: []
created_date: '2025-11-06 13:52'
updated_date: '2025-11-06 14:08'
labels: []
dependencies: []
---

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Command accepts document ID as parameter (e.g., 'doc-1')
- [x] #2 Returns absolute file path to the document
- [x] #3 Error handling for invalid format or non-existent documents
- [x] #4 User UAT: SA can use returned path to edit documents directly
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation returns absolute file path instead of relative path. This is more reliable for SA usage because bls wrapper changes cwd to session directory, making relative paths ambiguous. Absolute path works consistently regardless of where command is run from.
<!-- SECTION:NOTES:END -->
