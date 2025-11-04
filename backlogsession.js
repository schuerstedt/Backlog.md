#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory name for the current file
const __dirname = dirname(fileURLToPath(import.meta.url));

// Get all arguments after the script name
const rawArgs = process.argv.slice(2);

// The session directory should be created in the current working directory
const sessionDir = join(process.cwd(), "backlogsession");
if (!existsSync(sessionDir)) {
  mkdirSync(sessionDir, { recursive: true });
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
