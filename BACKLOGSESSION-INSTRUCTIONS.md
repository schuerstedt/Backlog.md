# BacklogSession - bls cli session backlog

bls is a cli command which allows for session specific task handling. It is mandatory in this repository to use by any planning task. During execution the agent can use bls or use its own planning system.

## Board Status Flow:

```
Plan → Approved → Doing → Done
           ↓
       Canceled
```

**Statuses:**

- `Plan` - Initial state for new tasks
- `Approved` - User has approved the task and its AC
- `Doing` - Work is in progress
- `Done` - All AC met and task completed
- `Canceled` - User disapproved the task

## Commands:

**Session Management:**

- `bls init` - Initialize a new session (automatically creates session with format `backlogsession/YYYY-MM-DD-#`, e.g. `2025-11-06-1`)
  - Sessions are auto-created for today's date
  - Multiple sessions per day are numbered sequentially (e.g., `2025-11-06-1`, `2025-11-06-2`)
  - **Do not** specify a session name - it's auto-generated

**Task Creation:**

- `bls task create "Demo" --ac "Acceptance1" --ac "Acceptance2"` - Create task Demo with two acceptance criteria

**Task Viewing:**

- `bls task list --plain` - List all tasks
- `bls task 1 --plain` - View task number 1

**Task Editing:**

```
Usage: bls task edit [options] <taskId>

Options:
  -t, --title <title>               Change task title
  -d, --description <text>          Task description (multi-line: bash $'Line1\nLine2', PowerShell "Line1`nLine2")
  -s, --status <status>             Change task status (Plan, Approved, Canceled, Doing, Done)
  -l, --label <labels>              Set labels
  --priority <priority>             Set task priority (high, medium, low)
  --ordinal <number>                Set task ordinal for custom ordering
  --plain                           Use plain text output after editing
  --add-label <label>               Add a label
  --remove-label <label>            Remove a label
  --ac <criteria>                   Add acceptance criteria (can be used multiple times)
  --remove-ac <index>               Remove acceptance criterion by index (1-based)
  --edit-ac <spec>                  Edit acceptance criterion (format: "index:text", e.g., "1:New text")
  --check-ac <index>                Check acceptance criterion by index (1-based)
  --uncheck-ac <index>              Uncheck acceptance criterion by index (1-based)
  --plan <text>                     Set implementation plan
  --notes <text>                    Set implementation notes (replaces existing)
  --append-notes <text>             Append to implementation notes (can be used multiple times)
  --depends-on <taskIds>            Set task dependencies (comma-separated or use multiple times)
```

** Doc files operations **

```
bls doc create <title>              Create a doc and return the doc id
bls doc list --plain                List all docs: docID - Title
bls doc getpath <docID>             Get the filesystem path to the doc for SA editing 

```

## Workflow:

### Session Initialization:

A new session is initialized when the user asks for it. `bls` automatically creates a new session if there is no session for today.

### Task Creation and Approval Process:

1. **Software Agent (SA) creates task(s)** - SA MUST create a task with Acceptance Criteria (AC) BEFORE discussing the task with the user
   - **Break down work into multiple atomic tasks** - When user requests a feature, SA should create MULTIPLE small tasks rather than one large task
   - Each task should be as atomic as possible and not exceed more than 5 AC
   - If a feature requires more than 5 AC, break it into several separate tasks
   - If not stated otherwise, the last AC must be a user UAT
   - SA can assume the user has the board view open and can see all tasks
2. **SA discusses with user** - SA changes AC during discussion with the user
3. **User approves** - Once user approves, SA sets the status to `Approved, user can approve tasks by using the task board manually`
4. **SA starts work** - SA can start working on approved tasks after user agrees, moving them to `Doing - SA should inform the user once an AC is met and update the task`
5. **SA completes work** - SA moves tasks to `Done` once User Acceptance Testing (UAT) is approved
6. **User disapproves** - If user disapproves a task, it is set to `Canceled`

### Acceptance Criteria Requirements:

- All AC of a task MUST be met by the SA before a task is set to `Done`, except when user agrees on a different flow
- SA can use `bls` for its internal planning (creating new tasks internally etc), but it is recommended that SA uses its own internal planning tools for actual execution during `Doing`
- **CRITICAL**: Once a task is in `Approved` status, SA MUST NEVER change the Acceptance Criteria without explicit user approval. If AC need modification after approval, SA must discuss with user first and get permission before making any changes.

### Special Tasks (Not Yet Implemented):

There are two default tasks created through initialization:

- **Task #1: "On Session Start"** - SA MUST apply all AC of #1 before actual work happens. Once all AC are fulfilled, #1 is moved to `Done`
- **Task #2: "On Session End"** - When all tasks are finished and user asks for a session end, SA MUST apply all AC of #2. When user asks for a new session, SA checks first if "On Session End" is `Done` before initiating a `bls init`

**Note:** Creation of tasks #1 and #2 is not implemented yet, so this requirement can be ignored for the moment.
