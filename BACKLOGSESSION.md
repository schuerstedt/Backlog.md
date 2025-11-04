# BacklogSession - Isolated Workspace Feature

BacklogSession provides session-isolated task management, perfect for AI agents, temporary projects, or experimentation without affecting your main backlog.

## Overview

When you run `backlogsession`, all operations happen in a dedicated `backlogsession/` subdirectory with its own:
- Task backlog
- Configuration (with custom workflow columns)
- Git history (within the session directory)
- File structure

This isolation allows you to:
- Test task management scenarios safely
- Give AI agents a sandbox for task experimentation
- Run temporary project planning sessions
- Use custom workflow columns without affecting main backlog

## Installation

BacklogSession is built into Backlog.md v1.18.5+. No additional installation needed.

```bash
# Verify installation
backlogsession --version
backlog session-mcp --help
```

## Quick Start

### 1. Initialize a Session

```bash
# Navigate to any directory
cd ~/my-project

# Initialize a session (creates backlogsession/ subdirectory)
backlogsession init "My Session Name"
```

This creates:
```
~/my-project/
  backlogsession/          # Session root
    backlog/               # Session backlog structure
      config.yml           # Custom columns: Plan, Approve, Cancel, Doing, Done
      tasks/
      drafts/
      completed/
      decisions/
      docs/
```

### 2. Use All Backlog Commands

All standard `backlog` commands work with the `backlogsession` wrapper:

```bash
# Create tasks
backlogsession task create "Plan the feature" --status Plan
backlogsession task create "Implement API" --status Doing

# View board with custom columns
backlogsession board

# Edit tasks
backlogsession task edit 1 --status Approve

# List tasks
backlogsession task list --status Doing

# Any other backlog command...
backlogsession doc create "Design Document"
backlogsession decision create "Architecture Choice"
```

### 3. MCP Server in Session Mode

For AI agent integration (Claude Desktop, etc.):

```bash
# Start session MCP server
backlog session-mcp start

# With debug logging
backlog session-mcp start --debug
```

## Custom Workflow Columns

BacklogSession uses a specialized workflow optimized for planning and approval:

| Column | Purpose | Use For |
|--------|---------|---------|
| **Plan** | Initial planning | Brainstorming, requirements gathering |
| **Approve** | Needs approval | Items ready for review/decision |
| **Cancel** | Rejected items | Cancelled or deprioritized work |
| **Doing** | Active work | Tasks currently in progress |
| **Done** | Completed | Finished items |

This differs from the standard Backlog.md workflow (To Do → In Progress → Done).

## MCP Integration

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "backlog-session": {
      "command": "backlog",
      "args": ["session-mcp", "start"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

### How It Works

The session MCP server:
1. Creates `backlogsession/` in the specified working directory
2. Operates entirely within that isolated workspace
3. Provides all standard Backlog.md MCP tools and resources
4. Uses custom workflow columns automatically

## Use Cases

### 1. AI Agent Sandbox
Give agents a safe space to experiment with tasks:
```bash
# Agent works in isolation
backlogsession task create "Explore API options"
backlogsession task create "Draft implementation plan"
```

### 2. Temporary Project Planning
Quick planning sessions without cluttering your main backlog:
```bash
backlogsession init "Q1 Planning Session"
backlogsession task create "Review goals"
backlogsession task create "Assign priorities"
```

### 3. Feature Exploration
Test out task structures before adding to main backlog:
```bash
backlogsession init "Feature Prototype"
backlogsession task create "Research libraries"
backlogsession task create "Create proof of concept"
```

### 4. Training & Demos
Show Backlog.md features without affecting real data:
```bash
backlogsession init "Demo Session"
backlogsession task create "Example task"
backlogsession board
```

## Commands Reference

### CLI Wrapper
```bash
backlogsession <command> [options]
```

All standard Backlog.md commands work:
- `init` - Initialize session (auto-patches config)
- `task` - Task management
- `draft` - Draft management
- `doc` - Documentation
- `decision` - Decision logs
- `board` - Kanban board view
- `config` - Configuration management
- etc.

### Session MCP Commands
```bash
# Start session MCP server (stdio transport)
backlog session-mcp start [--debug]

# Alternative shortcut
backlog session-mcp-start [--debug]
```

## Architecture

### Directory Structure
```
your-project/
  backlogsession/              # Session workspace
    backlog/                   # Session backlog
      config.yml               # Custom workflow config
      tasks/                   # Session tasks
      drafts/                  # Session drafts
      completed/               # Completed session tasks
      docs/                    # Session documentation
      decisions/               # Session decisions
      images/                  # Session diagrams
  backlog/                     # Main backlog (untouched)
    config.yml                 # Main workflow config
    tasks/                     # Main tasks
    ...
```

### Code Architecture
```
SessionMcpServer (src/mcp/session-server.ts)
    ↓ extends
McpServer (src/mcp/server.ts)
    ↓ extends
Core (src/core/backlog.ts)
    ↓ uses
FileSystem + Git
```

### How Config Patching Works

When you run `backlogsession init`:
1. Session directory created: `backlogsession/`
2. Normal `backlog init` runs inside session
3. Config file is auto-patched:
   ```yaml
   statuses: [Plan, Approve, Cancel, Doing, Done]
   ```
4. Session ready to use with custom workflow

## Comparison with Main Backlog

| Feature | Main Backlog | BacklogSession |
|---------|--------------|----------------|
| **Location** | `./backlog/` | `./backlogsession/backlog/` |
| **Workflow** | To Do → In Progress → Done | Plan → Approve → Cancel → Doing → Done |
| **Isolation** | Project-wide | Session-specific |
| **Command** | `backlog` | `backlogsession` |
| **MCP Server** | `backlog mcp start` | `backlog session-mcp start` |
| **Use Case** | Production work | Experiments, planning, agents |

## Tips & Best practices

### 1. Multiple Sessions
You can have sessions in different directories:
```bash
cd ~/project-a
backlogsession init "Session A"

cd ~/project-b
backlogsession init "Session B"
```

### 2. Clean Up Sessions
Sessions are just directories - delete when done:
```bash
rm -rf backlogsession/
```

### 3. Git Integration
Session directories can be git-ignored:
```gitignore
# .gitignore
backlogsession/
```

Or committed if you want to preserve session history.

### 4. Config Persistence
The config patch is permanent within the session. To change columns:
```bash
backlogsession config set statuses "Plan,Review,Build,Test,Deploy"
```

### 5. Export Session Tasks
Move useful session tasks to main backlog manually:
```bash
# View session task
backlogsession task view 1

# Recreate in main backlog
backlog task create "Task from session" --desc "..."
```

## Troubleshooting

### Session Directory Not Created
```bash
# Ensure you have write permissions
ls -la

# Verify backlogsession is installed
which backlogsession
backlogsession --version
```

### Config Not Patched
```bash
# Check config manually
cat backlogsession/backlog/config.yml

# Re-patch if needed
backlogsession config set statuses "Plan,Approve,Cancel,Doing,Done"
```

### MCP Server Not Starting
```bash
# Test with debug logging
backlog session-mcp start --debug

# Verify path in Claude config
cat ~/.config/Claude/claude_desktop_config.json
```

### Commands Affecting Main Backlog
```bash
# Ensure you're using the wrapper
backlogsession task list  # ✅ Session
backlog task list         # ⚠️ Main backlog

# Check current directory
pwd
ls -la backlogsession/
```

## Development

### Running Tests
```bash
# Test session wrapper
bun test src/test/backlogsession.test.ts

# All tests
bun test
```

### Building from Source
```bash
# Build includes backlogsession
bun run build

# Verify binaries
ls -la dist/
```

## Credits

- **Original Concept**: BacklogSession by edunmore
- **Source**: https://github.com/edunmore/BacklogSession/tree/codextry
- **Integration**: Marcus Schürstedt
- **Base Project**: Backlog.md by MrLesk

## See Also

- [Main README](README.md) - Backlog.md documentation
- [MARCUSCHANGELOG](MARCUSCHANGELOG.md) - Customization history
- [MCP Documentation](https://modelcontextprotocol.io/) - Model Context Protocol
