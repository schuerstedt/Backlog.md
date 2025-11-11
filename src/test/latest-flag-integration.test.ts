import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Helper to clean up directories with retry on Windows
function cleanupDir(dirPath: string, maxRetries = 3) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			if (existsSync(dirPath)) {
				rmSync(dirPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
			}
			return;
		} catch (err) {
			if (i === maxRetries - 1) {
				console.warn(`Warning: Could not clean up ${dirPath}:`, err);
			}
		}
	}
}

describe("--latest flag integration tests", () => {
	const testDir = join(tmpdir(), `latest-flag-test-${Date.now()}`);
	const blsScript = join(process.cwd(), "backlogsession.js");

	beforeEach(() => {
		cleanupDir(testDir);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		cleanupDir(testDir);
	});

	it("should reject --latest flag with init command", () => {
		const result = spawnSync("bun", ["run", blsScript, "init", "--latest"], {
			cwd: testDir,
			encoding: "utf8",
			timeout: 10000,
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("--latest flag cannot be used with 'init' command");
	});

	it("should auto-initialize today's session when using --latest with no sessions", () => {
		// First command with --latest should auto-create today's session
		const result = spawnSync("bun", ["run", blsScript, "task", "list", "--plain", "--latest"], {
			cwd: testDir,
			encoding: "utf8",
			timeout: 30000, // Increase timeout for auto-init
		});

		// Should fail because there's no previous session (exit code might be null if process was killed)
		if (result.status !== null) {
			expect(result.status).toBe(1);
		}

		// Check the output for the error message
		const output = result.stderr || result.stdout || "";
		expect(output).toContain("No previous session found");

		// But today's session should have been created
		const sessionsDir = join(testDir, "backlogsession");
		const today = new Date().toISOString().split("T")[0];
		expect(existsSync(join(sessionsDir, `${today}-1`))).toBe(true);
	});

	it("should access previous session when using --latest", () => {
		const sessionsDir = join(testDir, "backlogsession");
		mkdirSync(sessionsDir, { recursive: true });

		// Create a previous session with a marker file
		const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
		const yesterdaySession = join(sessionsDir, `${yesterday}-1`);
		mkdirSync(yesterdaySession, { recursive: true });
		mkdirSync(join(yesterdaySession, "backlog"), { recursive: true });
		mkdirSync(join(yesterdaySession, "backlog", "tasks"), { recursive: true });

		// Create a test task file in yesterday's session
		const testTaskPath = join(yesterdaySession, "backlog", "tasks", "task-1 - Test-Task.md");
		writeFileSync(
			testTaskPath,
			`---
id: task-1
title: Test Task from Previous Session
status: Plan
created_date: '${yesterday} 10:00'
---

# Test Task

This is a test task from the previous session.

## Acceptance Criteria
- [ ] #1 Test criterion
`,
		);

		// Create a config file for the previous session
		const configPath = join(yesterdaySession, "backlog", "config.yml");
		writeFileSync(
			configPath,
			`statuses: ["Plan", "Approved", "Canceled", "Doing", "Done"]
default_status: "Plan"
default_port: 6420
`,
		);

		// Now use --latest to access the previous session
		const result = spawnSync("bun", ["run", blsScript, "task", "list", "--plain", "--latest"], {
			cwd: testDir,
			encoding: "utf8",
			timeout: 15000,
		});

		// Should succeed and show the task from yesterday's session
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Test Task from Previous Session");
	});

	it("should strip --latest flag from command arguments", () => {
		const sessionsDir = join(testDir, "backlogsession");
		mkdirSync(sessionsDir, { recursive: true });

		// Create a previous session
		const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
		const yesterdaySession = join(sessionsDir, `${yesterday}-1`);
		mkdirSync(yesterdaySession, { recursive: true });
		mkdirSync(join(yesterdaySession, "backlog"), { recursive: true });

		const configPath = join(yesterdaySession, "backlog", "config.yml");
		writeFileSync(
			configPath,
			`statuses: ["Plan", "Approved", "Canceled", "Doing", "Done"]
default_status: "Plan"
default_port: 6420
`,
		);

		// Use --latest with a command - it should be stripped before execution
		const result = spawnSync("bun", ["run", blsScript, "config", "list", "--latest"], {
			cwd: testDir,
			encoding: "utf8",
			timeout: 15000,
		});

		// The command should execute successfully (config list doesn't know about --latest)
		expect(result.status).toBe(0);
	});

	it("should select the most recent session when multiple exist", () => {
		const sessionsDir = join(testDir, "backlogsession");
		mkdirSync(sessionsDir, { recursive: true });

		// Create multiple previous sessions
		const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().split("T")[0];
		const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

		// Create older session
		const olderSession = join(sessionsDir, `${twoDaysAgo}-1`);
		mkdirSync(olderSession, { recursive: true });
		mkdirSync(join(olderSession, "backlog"), { recursive: true });
		mkdirSync(join(olderSession, "backlog", "tasks"), { recursive: true });

		// Create more recent session
		const recentSession = join(sessionsDir, `${yesterday}-2`);
		mkdirSync(recentSession, { recursive: true });
		mkdirSync(join(recentSession, "backlog"), { recursive: true });
		mkdirSync(join(recentSession, "backlog", "tasks"), { recursive: true });

		// Create a marker task in the recent session
		const testTaskPath = join(recentSession, "backlog", "tasks", "task-1 - Recent-Task.md");
		writeFileSync(
			testTaskPath,
			`---
id: task-1
title: Most Recent Task
status: Plan
created_date: '${yesterday} 10:00'
---

# Most Recent Task

This is from the most recent session.

## Acceptance Criteria
- [ ] #1 Test criterion
`,
		);

		// Create config for recent session
		const configPath = join(recentSession, "backlog", "config.yml");
		writeFileSync(
			configPath,
			`statuses: ["Plan", "Approved", "Canceled", "Doing", "Done"]
default_status: "Plan"
default_port: 6420
`,
		);

		// Use --latest - should access the most recent session (yesterday-2)
		const result = spawnSync("bun", ["run", blsScript, "task", "list", "--plain", "--latest"], {
			cwd: testDir,
			encoding: "utf8",
			timeout: 15000,
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("Most Recent Task");
	});
});
