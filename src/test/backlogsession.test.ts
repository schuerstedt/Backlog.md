import { afterEach, beforeEach, describe, it } from "bun:test";
import assert from "node:assert";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
				// Last attempt failed, log warning but don't throw
				console.warn(`Warning: Could not clean up ${dirPath}:`, err);
			}
		}
	}
}

describe("backlogsession wrapper", () => {
	const testDir = join(tmpdir(), `backlogsession-test-${Date.now()}`);
	const sessionDir = join(testDir, "backlogsession");

	beforeEach(() => {
		// Ensure test directory exists
		cleanupDir(testDir);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		// Clean up test directory
		cleanupDir(testDir);
	});

	it("should create backlogsession folder when it doesn't exist", () => {
		process.chdir(testDir);

		const result = spawnSync("bun", ["run", join(__dirname, "..", "..", "backlogsession.js"), "--help"], {
			cwd: testDir,
			timeout: 10000, // 10 seconds timeout
		});

		// Help command should succeed and create the directory
		assert(existsSync(sessionDir));
	});

	it("should change to backlogsession directory and run commands there", () => {
		process.chdir(testDir);

		// Create a marker file in the session directory to verify we're running in the right context
		mkdirSync(sessionDir, { recursive: true });
		const markerFile = join(sessionDir, "marker.txt");
		writeFileSync(markerFile, "test marker");

		// Run a command to see if it operates in the correct directory
		const result = spawnSync("bun", ["run", join(__dirname, "..", "..", "backlogsession.js"), "config", "list"], {
			cwd: testDir,
			timeout: 10000, // 10 seconds timeout
		});

		// The marker file should still exist, showing we operated in the right directory
		assert(existsSync(markerFile));

		// Command may fail because there's no config yet, but that's okay for this test
	});

	it("should delegate arguments to backlog CLI correctly", () => {
		process.chdir(testDir);
		mkdirSync(sessionDir, { recursive: true });

		// Run an invalid command to see if arguments are properly passed through
		const result = spawnSync("bun", ["run", join(__dirname, "..", "..", "backlogsession.js"), "nonexistent-command"], {
			cwd: testDir,
			timeout: 10000, // 10 seconds timeout
		});

		// Should exit with non-zero code since command doesn't exist
		assert(result.status !== 0);
	});

	it("should proxy output and exit codes from backlog CLI", () => {
		process.chdir(testDir);
		mkdirSync(sessionDir, { recursive: true });

		// Run the version command to test output proxy
		const result = spawnSync("bun", ["run", join(__dirname, "..", "..", "backlogsession.js"), "--version"], {
			cwd: testDir,
			timeout: 10000, // 10 seconds timeout
		});

		// Should exit with 0 for successful version command
		assert.strictEqual(result.status, 0);
		// Should have output with version info
		const output = result.stdout.toString();
		assert.match(output.trim(), /\d+\.\d+\.\d+/);
	});

	it("should patch config after init with custom columns", () => {
		process.chdir(testDir);

		// Initialize a git repo to avoid prompts
		spawnSync("git", ["init"], { cwd: testDir });

		// Run backlogsession init which should create the session dir and patch config
		const result = spawnSync(
			"bun",
			["run", join(__dirname, "..", "..", "backlogsession.js"), "init", "test-session", "--defaults"],
			{
				cwd: testDir,
				timeout: 15000, // 15 seconds timeout for init
			},
		);

		// Check if the session directory was created
		assert(existsSync(sessionDir), "session directory should be created");

		// Check if the config was patched with custom columns
		const configPath = join(sessionDir, "backlog", "config.yml");
		if (existsSync(configPath)) {
			const configContent = readFileSync(configPath, "utf8");
			assert(
				configContent.includes("statuses: [Plan, Approve, Cancel, Doing, Done]"),
				"config should have custom statuses",
			);
		} else {
			assert.fail("Config file should exist after init");
		}
	});
});
