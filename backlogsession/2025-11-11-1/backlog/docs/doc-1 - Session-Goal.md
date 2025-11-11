---
id: doc-1
title: Session Goal
type: other
created_date: '2025-11-11 10:13'
updated_date: '2025-11-11 10:20'
---
# Session Goal: Implementation of --latest flag for bls

## Objective
Add a `--latest` flag to the `bls` command that allows the agent to quickly access the last session. 

## Context
When there are open task in the last session, the sa cannot read them at the moment. By implementing the --latest flag it can do that. This should trigger a bls init if there is no session for today and than executing the command with the --latest flag again. bls init does not support the --latest flag. 

## Scope
- Add `--latest` flag to relevant bls commands
- Implement logic to identify the most recent session directory
- instead if switching to the current session directory --latest triggers to switch to the previous session directory
- the --latest flag is than delete from the bls command executed in the last session directory
- for now we allow ALL commands with the --latest flag except hte init command
- Update command help text and documentation
- Add tests for the new functionality
