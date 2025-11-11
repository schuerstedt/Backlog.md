#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

// Get the directory name for the current file
const __dirname = dirname(fileURLToPath(import.meta.url));

// Get all arguments after the script name
const rawArgs = process.argv.slice(2);

// Utility: walk upwards to find a directory matching a predicate
function findUp(startDir, predicate) {
  let dir = startDir;
  while (true) {
    if (predicate(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Detect if current directory is already a backlog session (initialized project)
function isBacklogProject(dir) {
  return (
    existsSync(join(dir, "backlog", "config.yml")) ||
    existsSync(join(dir, "config.yml")) ||
    existsSync(join(dir, "backlog.json"))
  );
}

const SESSION_NAME_RE = /^\d{4}-\d{2}-\d{2}-\d+$/;

// Find the session root directory if CWD is inside one (backlogsession/YYYY-MM-DD-N[/...])
function resolveCurrentSessionDir(cwd) {
  const parent = findUp(cwd, (dir) => basename(dir) === "backlogsession");
  if (!parent) return null;
  // walk up from cwd until we reach a direct child of parent that matches session name
  let dir = cwd;
  while (dir && dir.length >= parent.length) {
    if (dirname(dir) === parent && SESSION_NAME_RE.test(basename(dir))) {
      return dir;
    }
    if (dir === parent) break;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

// Resolve the sessions parent directory relative to current location.
// If we're inside a sessions directory already, find the nearest ancestor named "backlogsession".
// Otherwise default to creating/using `./backlogsession` from the current working directory.
function resolveSessionsParentDir(cwd) {
  // if inside .../backlogsession[/YYYY-MM-DD-N] return that backlogsession ancestor
  const found = findUp(cwd, (dir) => basename(dir) === "backlogsession");
  if (found) return found;
  const parent = join(cwd, "backlogsession");
  if (!existsSync(parent)) mkdirSync(parent, { recursive: true });
  return parent;
}

/**
 * Get all session directories for today
 * @param {string} today - Date string in YYYY-MM-DD format
 * @returns {string[]} Array of session directory paths sorted by number
 */
function getTodaysSessions(today, sessionsParentDir) {
  if (!existsSync(sessionsParentDir)) {
    return [];
  }
  
  const entries = readdirSync(sessionsParentDir, { withFileTypes: true });
  const todaySessions = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith(`${today}-`))
    .map(entry => {
      const match = entry.name.match(new RegExp(`^${today.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`));
      return match ? { path: join(sessionsParentDir, entry.name), number: parseInt(match[1], 10) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.number - b.number);
  
  return todaySessions.map(s => s.path);
}

/**
 * Get the last (highest numbered) session for today, or null if none exist
 * @param {string} today - Date string in YYYY-MM-DD format
 * @returns {string|null} Path to the last session or null
 */
function getLastSessionForToday(today, sessionsParentDir) {
  const sessions = getTodaysSessions(today, sessionsParentDir);
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}

/**
 * Create a new session directory for today with the next consecutive number
 * @param {string} today - Date string in YYYY-MM-DD format
 * @returns {string} Path to the newly created session directory
 */
function createNewSessionForToday(today, sessionsParentDir) {
  const sessions = getTodaysSessions(today, sessionsParentDir);
  const nextNumber = sessions.length + 1;
  const newSessionDir = join(sessionsParentDir, `${today}-${nextNumber}`);
  mkdirSync(newSessionDir, { recursive: true });
  return newSessionDir;
}

/**
 * Get all session directories (excluding today)
 * @param {string} today - Date string in YYYY-MM-DD format to exclude
 * @param {string} sessionsParentDir - Path to the backlogsession directory
 * @returns {Array<{path: string, date: string, number: number}>} Array of session objects sorted by date (newest first), then by number (highest first)
 */
function getAllSessions(today, sessionsParentDir) {
  if (!existsSync(sessionsParentDir)) {
    return [];
  }
  
  const entries = readdirSync(sessionsParentDir, { withFileTypes: true });
  const sessions = entries
    .filter(entry => entry.isDirectory() && SESSION_NAME_RE.test(entry.name))
    .map(entry => {
      const match = entry.name.match(/^(\d{4}-\d{2}-\d{2})-(\d+)$/);
      if (!match) return null;
      const date = match[1];
      const number = parseInt(match[2], 10);
      // Exclude today's sessions
      if (date === today) return null;
      return { path: join(sessionsParentDir, entry.name), date, number };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Sort by date descending (newest first)
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      // Then by number descending (highest number first)
      return b.number - a.number;
    });
  
  return sessions;
}

/**
 * Get the most recent session directory (excluding today)
 * @param {string} today - Date string in YYYY-MM-DD format to exclude
 * @param {string} sessionsParentDir - Path to the backlogsession directory
 * @returns {string|null} Path to the most recent session or null if none exist
 */
function getLatestSession(today, sessionsParentDir) {
  const sessions = getAllSessions(today, sessionsParentDir);
  return sessions.length > 0 ? sessions[0].path : null;
}

// Determine today's date
const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

// Determine which session directory to use
const cwd = process.cwd();
const isInitCommand = rawArgs[0] === "init";

// Check for --latest flag
const hasLatestFlag = rawArgs.includes("--latest");

// Don't allow --latest with init command
if (isInitCommand && hasLatestFlag) {
  console.error("Error: --latest flag cannot be used with 'init' command");
  process.exit(1);
}

let sessionDir;

// If we're already inside a backlog project (a session), use it directly for non-init commands
const currentSessionDir = resolveCurrentSessionDir(cwd);
const sessionsParentDir = resolveSessionsParentDir(cwd);

// Wrap in async IIFE to support await
(async () => {
  // Handle --latest flag: use previous session instead of today's
  if (hasLatestFlag) {
    // First, ensure today's session exists
    const todaySession = currentSessionDir || getLastSessionForToday(today, sessionsParentDir);
    
    if (!todaySession) {
      console.log("No session found for today. Auto-initializing first session...");
      sessionDir = createNewSessionForToday(today, sessionsParentDir);
      
      const createdName = basename(sessionDir);
      const autoInitArgs = ["init", `Session ${createdName}`, "--defaults", "--agent-instructions", "none"];
      const compiledAvailable = (() => {
        try {
          const res = spawnSync("backlog", ["--version"], { stdio: "ignore" });
          return res.status === 0;
        } catch { return false; }
      })();
      const initCmd = compiledAvailable ? "backlog" : "bun";
      const initArgs = compiledAvailable ? autoInitArgs : [join(__dirname, "src", "cli.ts"), ...autoInitArgs];
      
      const initResult = spawnSync(initCmd, initArgs, {
        stdio: "inherit",
        cwd: sessionDir,
      });
      
      if (initResult.status === 0) {
        await patchConfigAfterInit(sessionDir);
        await executeInitCommands(sessionDir);
        console.log(`✓ Session initialized: ${sessionDir}`);
      } else {
        console.error(`Failed to auto-initialize session (exit code: ${initResult.status})`);
        process.exit(initResult.status || 1);
      }
    }
    
    // Now get the latest/previous session
    sessionDir = getLatestSession(today, sessionsParentDir);
    
    if (!sessionDir) {
      console.error("Error: No previous session found. Cannot use --latest flag.");
      process.exit(1);
    }
    
    console.log(`Using latest session: ${basename(sessionDir)}`);
  } else if (isInitCommand) {
    // For 'init' command, always create a new session
    sessionDir = createNewSessionForToday(today, sessionsParentDir);
  } else {
    // For other commands, use the last session for today, or auto-create if none exists
    sessionDir = currentSessionDir || getLastSessionForToday(today, sessionsParentDir);
    
    if (!sessionDir) {
      // No session exists for today - auto-initialize
      console.log("No session found for today. Auto-initializing first session...");
      sessionDir = createNewSessionForToday(today, sessionsParentDir);
      
      // Auto-run init command synchronously so we can continue with the original command
      const createdName = basename(sessionDir); // e.g. 2025-11-04-1
      const autoInitArgs = ["init", `Session ${createdName}` , "--defaults", "--agent-instructions", "none"];
      const compiledAvailable = (() => {
        try {
          const res = spawnSync("backlog", ["--version"], { stdio: "ignore" });
          return res.status === 0;
        } catch { return false; }
      })();
      const initCmd = compiledAvailable ? "backlog" : "bun";
      const initArgs = compiledAvailable ? autoInitArgs : [join(__dirname, "src", "cli.ts"), ...autoInitArgs];
      
      const initResult = spawnSync(initCmd, initArgs, {
        stdio: "inherit",
        cwd: sessionDir,
      });
      
      if (initResult.status === 0) {
        await patchConfigAfterInit(sessionDir);
        // When auto-initializing (non-interactive), avoid starting long-running services like the browser.
        await executeInitCommands(sessionDir, { skipBrowser: true });
        console.log(`✓ Session initialized: ${sessionDir}`);
        // Continue with the original command - don't exit!
      } else {
        console.error(`Failed to auto-initialize session (exit code: ${initResult.status})`);
        process.exit(initResult.status || 1);
      }
    }
  }

  // Optional debug logging
  if (process.env.BACKLOGSESSION_DEBUG === "1") {
    console.error(`[backlogsession] cwd=${cwd}`);
    console.error(`[backlogsession] sessionsParentDir=${sessionsParentDir}`);
    console.error(`[backlogsession] using sessionDir=${sessionDir}`);
  }

  // Try to determine the backlog CLI path
  let backlogCommand;
  
  // Remove --latest flag from arguments before passing to backlog CLI
  let argsToPass = rawArgs.filter(arg => arg !== "--latest");

  // Prefer compiled CLI if available, else fall back to dev runner
  const compiledAvailable = (() => {
    try {
      const res = spawnSync("backlog", ["--version"], { stdio: "ignore" });
      return res.status === 0;
    } catch { return false; }
  })();

  if (compiledAvailable) {
    backlogCommand = "backlog";
    argsToPass = [...argsToPass];
  } else {
    // In development mode in this project, we run src/cli.ts with bun
    backlogCommand = "bun";
    argsToPass = [join(__dirname, "src", "cli.ts"), ...argsToPass];
  }

  // Handle the special 'init' command to patch the config after initialization
  if (rawArgs[0] === "init") {
    // Auto-generate session name with defaults
    const createdName = basename(sessionDir); // e.g. 2025-11-06-9
    const autoInitArgs = ["init", `Session ${createdName}`, "--defaults", "--agent-instructions", "none"];
    
    // Run backlog init in the session directory
    const initArgs = compiledAvailable 
      ? autoInitArgs  // For compiled version, use auto-generated args
      : [join(__dirname, "src", "cli.ts"), ...autoInitArgs]; // For dev mode, use auto-generated args
    
    const initChild = spawn(backlogCommand, initArgs, {
      stdio: "inherit", // Inherit TTY to support interactive prompts and proper UI
      cwd: sessionDir,
    });

    // stdio is inherited; no need to manually forward streams

    initChild.on("exit", async (code) => {
      if (code === 0) {
        // If init succeeded, patch the config file
        await patchConfigAfterInit(sessionDir);
        // Execute initialization commands if initcommands.md exists (interactive init: do not skip browser)
        await executeInitCommands(sessionDir, { skipBrowser: false });
      }
      process.exit(code || 0);
    });

    initChild.on("error", (err) => {
      console.error("Failed to run backlog init:", err);
      process.exit(1);
    });
  } else {
    // For all other commands, just pass them through to the session directory
    const child = spawn(backlogCommand, argsToPass, {
      stdio: "inherit", // Inherit TTY for full-screen UI and interactive commands
      cwd: sessionDir,
    });

    // stdio is inherited; no need to manually forward streams

    // Handle exit
    child.on("exit", (code) => {
      process.exit(code || 0);
    });

    // Handle errors
    child.on("error", (err) => {
      if (err.code === "ENOENT") {
        console.error(`Command not found: ${backlogCommand}`);
        console.error("Make sure Bun is installed and in your PATH");
      } else {
        console.error("Failed to start backlog:", err);
      }
      process.exit(1);
    });
  }
})();

// Execute commands from initcommands.md if it exists
async function executeInitCommands(sessionDir, options = {}) {
  const backlogsessionDir = dirname(sessionDir);
  const initCommandsPath = join(backlogsessionDir, "initcommands.md");
  
  // Create default initcommands.md if it doesn't exist
  if (!existsSync(initCommandsPath)) {
    const defaultCommands = `# Initialization Commands

These commands are executed automatically after \`bls init\` completes successfully.

## Default Commands:

\`\`\`bash
bls task create "On Session Start" --ac "git branch for session created" --ac "Session Goal template filled"
bls task create "On Session End" --ac "Chat history copied to session docs" --ac "Session summary written to session docs" --ac "git merged"
bls doc create "Session Goal"
bls doc create "Session User Notes"
bls browser
\`\`\`
`;
    writeFileSync(initCommandsPath, defaultCommands, "utf8");
    console.log(`✓ Created default initcommands.md at ${initCommandsPath}`);
  }
  
  // Read and parse the initcommands.md file
  try {
    const content = readFileSync(initCommandsPath, "utf8");
    
    // Extract commands from code blocks
    const codeBlockRegex = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
    const commands = [];
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const block = match[1];
      // Split by lines and filter out empty lines and comments
      const lines = block.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      commands.push(...lines);
    }
    
    if (commands.length === 0) {
      console.log("No commands found in initcommands.md");
      return;
    }
    
    console.log(`\n✓ Executing ${commands.length} initialization command(s)...`);

    // Execute each command sequentially in the session directory
    for (const command of commands) {
      // Optionally skip starting the browser during auto-init
      if (options.skipBrowser) {
        const normalized = command.trim().toLowerCase();
        if (normalized === "bls browser" || normalized.startsWith("bls browser ")) {
          console.log(`  → Skipping long-running command during auto-init: ${command}`);
          continue;
        }
      }

      console.log(`  → ${command}`);
      
      try {
        // Execute the command directly through the shell
        // This preserves quoted arguments properly
        const result = spawnSync(command, {
          cwd: sessionDir,
          stdio: 'inherit',
          shell: true,
        });
        
        if (result.status !== 0) {
          console.error(`  ✗ Command failed with exit code ${result.status}`);
        }
      } catch (err) {
        console.error(`  ✗ Failed to execute command: ${err.message}`);
      }
    }

    console.log("✓ Initialization commands completed\n");
  } catch (err) {
    console.error(`Error executing init commands: ${err.message}`);
  }
}

// Find a free port starting from startPort
function findFreePort(startPort = 6420) {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      if (port > 65535) {
        reject(new Error('No free port found'));
        return;
      }
      
      const server = createServer();
      
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try next one
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
      
      server.once('listening', () => {
        // Port is free
        const freePort = server.address().port;
        server.close(() => {
          resolve(freePort);
        });
      });
      
      // Listen on all interfaces (0.0.0.0) to properly detect port conflicts
      server.listen(port);
    };
    
    tryPort(startPort);
  });
}

// Function to patch the config file after init
async function patchConfigAfterInit(sessionDir) {
  try {
    // Try both possible config file names: backlog.json and config.yml
    let configPath = join(sessionDir, "backlog.json");
    let isYaml = false;
    
    if (!existsSync(configPath)) {
      configPath = join(sessionDir, "config.yml");
      isYaml = true;
    }
    
    if (!existsSync(configPath)) {
      configPath = join(sessionDir, "backlog", "config.yml"); // In the backlog directory
      isYaml = true;
    }
    
    if (existsSync(configPath)) {
      const configContent = readFileSync(configPath, "utf8");
      
      // Find a free port for this session
      const freePort = await findFreePort(6420);
      
      if (isYaml) {
        // For YAML config, find and replace the statuses, default_status, and default_port lines
        const lines = configContent.split('\n');
        const updatedLines = [];
        let foundStatuses = false;
        let foundDefaultStatus = false;
        let foundDefaultPort = false;
        
        for (const line of lines) {
          if (line.trim().startsWith('statuses:')) {
            // Replace the statuses line with our custom ones
            // Preserve the original indentation
            const indent = line.match(/^\s*/)?.[0] || '';
            updatedLines.push(`${indent}statuses: ["Plan", "Approved", "Canceled", "Doing", "Done"]`);
            foundStatuses = true;
          } else if (line.trim().startsWith('default_status:')) {
            // Replace default_status with "Plan"
            const indent = line.match(/^\s*/)?.[0] || '';
            updatedLines.push(`${indent}default_status: "Plan"`);
            foundDefaultStatus = true;
          } else if (line.trim().startsWith('default_port:')) {
            // Replace default_port with the free port
            const indent = line.match(/^\s*/)?.[0] || '';
            updatedLines.push(`${indent}default_port: ${freePort}`);
            foundDefaultPort = true;
          } else {
            updatedLines.push(line);
          }
        }
        
        if (!foundStatuses) {
          // If statuses line was not found, append it
          updatedLines.push('statuses: ["Plan", "Approved", "Canceled", "Doing", "Done"]');
        }
        
        if (!foundDefaultStatus) {
          // If default_status was not found, append it
          updatedLines.push('default_status: "Plan"');
        }
        
        if (!foundDefaultPort) {
          // If default_port was not found, append it
          updatedLines.push(`default_port: ${freePort}`);
        }
        
        writeFileSync(configPath, updatedLines.join('\n'));
        console.log(`✓ Patched backlog configuration with custom columns: Plan, Approved, Canceled, Doing, Done (default: Plan, port: ${freePort})`);
      } else {
        // Parse JSON config
        const config = JSON.parse(configContent);

        // Update statuses, default_status, and default_port
        config.statuses = ["Plan", "Approved", "Canceled", "Doing", "Done"];
        config.default_status = "Plan";
        config.defaultPort = freePort;

        // Write the updated config back
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`✓ Patched backlog configuration with custom columns: Plan, Approved, Canceled, Doing, Done (default: Plan, port: ${freePort})`);
      }
    } else {
      console.log("Note: Config file not found after init, config patching skipped.");
    }
  } catch (error) {
    console.error("Failed to patch config after init:", error);
  }
}
