#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

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

// Determine today's date
const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

// Determine which session directory to use
const cwd = process.cwd();
const isInitCommand = rawArgs[0] === "init";
let sessionDir;

// If we're already inside a backlog project (a session), use it directly for non-init commands
const currentSessionDir = resolveCurrentSessionDir(cwd);
const sessionsParentDir = resolveSessionsParentDir(cwd);

if (isInitCommand) {
  // For 'init' command, always create a new session
  sessionDir = createNewSessionForToday(today, sessionsParentDir);
} else {
  // For other commands, use the last session for today, or auto-create if none exists
  sessionDir = currentSessionDir || getLastSessionForToday(today, sessionsParentDir);
  
  if (!sessionDir) {
    // No session exists for today - auto-initialize
    console.log("No session found for today. Auto-initializing first session...");
    sessionDir = createNewSessionForToday(today, sessionsParentDir);
    
    // Auto-run init command
    const createdName = basename(sessionDir); // e.g. 2025-11-04-1
    const autoInitArgs = ["init", `Session ${createdName}` , "--defaults", "--agent-instructions", "none"];
    const initChild = spawn("bun", [join(__dirname, "src", "cli.ts"), ...autoInitArgs], {
      stdio: "inherit",
      cwd: sessionDir,
    });
    
    initChild.on("exit", (code) => {
      if (code === 0) {
        patchConfigAfterInit(sessionDir);
        console.log(`✓ Session initialized: ${sessionDir}`);
        console.log("Now you can run your command again.");
      }
      process.exit(code || 0);
    });
    
    initChild.on("error", (err) => {
      console.error("Failed to auto-initialize session:", err);
      process.exit(1);
    });
    
    process.exit(0); // Exit successfully after auto-initialization
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
let argsToPass = rawArgs;

// In development mode in this project, we run src/cli.ts with bun
backlogCommand = "bun";
argsToPass = [join(__dirname, "src", "cli.ts"), ...rawArgs];

// Handle the special 'init' command to patch the config after initialization
if (rawArgs[0] === "init") {
  // Run backlog init in the session directory
  const initChild = spawn(backlogCommand, argsToPass, {
    stdio: "inherit", // Inherit TTY to support interactive prompts and proper UI
    cwd: sessionDir,
  });

  // stdio is inherited; no need to manually forward streams

  initChild.on("exit", (code) => {
    if (code === 0) {
      // If init succeeded, patch the config file
      patchConfigAfterInit(sessionDir);
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

// Function to patch the config file after init
function patchConfigAfterInit(sessionDir) {
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
      
      if (isYaml) {
        // For YAML config, find and replace the statuses line
        const lines = configContent.split('\n');
        const updatedLines = [];
        let foundStatuses = false;
        
        for (const line of lines) {
          if (line.trim().startsWith('statuses:')) {
            // Replace the statuses line with our custom ones
            // Preserve the original indentation
            const indent = line.match(/^\s*/)?.[0] || '';
            updatedLines.push(`${indent}statuses: [Plan, Approve, Cancel, Doing, Done]`);
            foundStatuses = true;
          } else {
            updatedLines.push(line);
          }
        }
        
        if (!foundStatuses) {
          // If statuses line was not found, append it
          updatedLines.push('statuses: [Plan, Approve, Cancel, Doing, Done]');
        }
        
        writeFileSync(configPath, updatedLines.join('\n'));
        console.log("✓ Patched backlog configuration with custom columns: Plan, Approve, Cancel, Doing, Done");
      } else {
        // Parse JSON config
        const config = JSON.parse(configContent);

        // Update statuses to Plan, Approve, Cancel, Doing, Done
        config.statuses = ["Plan", "Approve", "Cancel", "Doing", "Done"];

        // Write the updated config back
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log("✓ Patched backlog configuration with custom columns: Plan, Approve, Cancel, Doing, Done");
      }
    } else {
      console.log("Note: Config file not found after init, config patching skipped.");
    }
  } catch (error) {
    console.error("Failed to patch config after init:", error);
  }
}
