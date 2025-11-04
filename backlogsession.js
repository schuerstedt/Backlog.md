#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory name for the current file
const __dirname = dirname(fileURLToPath(import.meta.url));

// Get all arguments after the script name
const rawArgs = process.argv.slice(2);

// Parent directory for all sessions
const sessionsParentDir = join(process.cwd(), "backlogsession");
if (!existsSync(sessionsParentDir)) {
  mkdirSync(sessionsParentDir, { recursive: true });
}

/**
 * Get all session directories for today
 * @param {string} today - Date string in YYYY-MM-DD format
 * @returns {string[]} Array of session directory paths sorted by number
 */
function getTodaysSessions(today) {
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
function getLastSessionForToday(today) {
  const sessions = getTodaysSessions(today);
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}

/**
 * Create a new session directory for today with the next consecutive number
 * @param {string} today - Date string in YYYY-MM-DD format
 * @returns {string} Path to the newly created session directory
 */
function createNewSessionForToday(today) {
  const sessions = getTodaysSessions(today);
  const nextNumber = sessions.length + 1;
  const newSessionDir = join(sessionsParentDir, `${today}-${nextNumber}`);
  mkdirSync(newSessionDir, { recursive: true });
  return newSessionDir;
}

// Determine today's date
const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

// Determine which session directory to use
let sessionDir;
const isInitCommand = rawArgs[0] === "init";

if (isInitCommand) {
  // For 'init' command, always create a new session
  sessionDir = createNewSessionForToday(today);
} else {
  // For other commands, use the last session for today, or auto-create if none exists
  sessionDir = getLastSessionForToday(today);
  
  if (!sessionDir) {
    // No session exists for today - auto-initialize
    console.log("No session found for today. Auto-initializing first session...");
    sessionDir = createNewSessionForToday(today);
    
    // Auto-run init command
    const autoInitArgs = ["init", `Session ${today}-1`, "--defaults", "--agent-instructions", "none"];
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
    stdio: "pipe",  // Use pipe to capture output for proper handling
    cwd: sessionDir,
  });

  // Forward stdout and stderr
  initChild.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  initChild.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

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
    stdio: "pipe",  // Use pipe to capture and forward output properly
    cwd: sessionDir,
  });

  // Forward stdout and stderr to maintain transparency
  child.stdout.on("data", (data) => {
    process.stdout.write(data);
  });

  child.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

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
        config.statuses = ["Plan, Approve, Cancel, Doing, Done"];
        
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
