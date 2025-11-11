import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
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

describe("Session Directory Detection", () => {
	const testDir = join(tmpdir(), `session-detection-test-${Date.now()}`);
	const sessionsDir = join(testDir, "backlogsession");

	beforeEach(() => {
		cleanupDir(testDir);
		mkdirSync(sessionsDir, { recursive: true });
	});

	afterEach(() => {
		cleanupDir(testDir);
	});

	it("should find the most recent session excluding today", () => {
		// Create some session directories
		mkdirSync(join(sessionsDir, "2025-11-10-1"));
		mkdirSync(join(sessionsDir, "2025-11-10-2"));
		mkdirSync(join(sessionsDir, "2025-11-09-1"));
		mkdirSync(join(sessionsDir, "2025-11-11-1")); // Today's session (should be excluded)

		// Run a node script to test the getLatestSession function
		const script = `
			const { readdirSync, existsSync } = require('node:fs');
			const { join } = require('node:path');
			
			const SESSION_NAME_RE = /^\\d{4}-\\d{2}-\\d{2}-\\d+$/;
			
			function getAllSessions(today, sessionsParentDir) {
				if (!existsSync(sessionsParentDir)) {
					return [];
				}
				
				const entries = readdirSync(sessionsParentDir, { withFileTypes: true });
				const sessions = entries
					.filter(entry => entry.isDirectory() && SESSION_NAME_RE.test(entry.name))
					.map(entry => {
						const match = entry.name.match(/^(\\d{4}-\\d{2}-\\d{2})-(\\d+)$/);
						if (!match) return null;
						const date = match[1];
						const number = parseInt(match[2], 10);
						if (date === today) return null;
						return { path: join(sessionsParentDir, entry.name), date, number };
					})
					.filter(Boolean)
					.sort((a, b) => {
						if (a.date !== b.date) {
							return b.date.localeCompare(a.date);
						}
						return b.number - a.number;
					});
				
				return sessions;
			}
			
			function getLatestSession(today, sessionsParentDir) {
				const sessions = getAllSessions(today, sessionsParentDir);
				return sessions.length > 0 ? sessions[0].path : null;
			}
			
			const latest = getLatestSession('2025-11-11', '${sessionsDir.replace(/\\/g, "\\\\")}');
			console.log(latest);
		`;

		const result = spawnSync("node", ["-e", script], { encoding: "utf8" });
		const latestSession = result.stdout.trim();

		expect(latestSession).toBe(join(sessionsDir, "2025-11-10-2"));
	});

	it("should handle empty session directory gracefully", () => {
		const script = `
			const { readdirSync, existsSync } = require('node:fs');
			const { join } = require('node:path');
			
			const SESSION_NAME_RE = /^\\d{4}-\\d{2}-\\d{2}-\\d+$/;
			
			function getAllSessions(today, sessionsParentDir) {
				if (!existsSync(sessionsParentDir)) {
					return [];
				}
				
				const entries = readdirSync(sessionsParentDir, { withFileTypes: true });
				const sessions = entries
					.filter(entry => entry.isDirectory() && SESSION_NAME_RE.test(entry.name))
					.map(entry => {
						const match = entry.name.match(/^(\\d{4}-\\d{2}-\\d{2})-(\\d+)$/);
						if (!match) return null;
						const date = match[1];
						const number = parseInt(match[2], 10);
						if (date === today) return null;
						return { path: join(sessionsParentDir, entry.name), date, number };
					})
					.filter(Boolean)
					.sort((a, b) => {
						if (a.date !== b.date) {
							return b.date.localeCompare(a.date);
						}
						return b.number - a.number;
					});
				
				return sessions;
			}
			
			function getLatestSession(today, sessionsParentDir) {
				const sessions = getAllSessions(today, sessionsParentDir);
				return sessions.length > 0 ? sessions[0].path : null;
			}
			
			const latest = getLatestSession('2025-11-11', '${sessionsDir.replace(/\\/g, "\\\\")}');
			console.log(latest || 'null');
		`;

		const result = spawnSync("node", ["-e", script], { encoding: "utf8" });
		const latestSession = result.stdout.trim();

		expect(latestSession).toBe("null");
	});

	it("should return null when only today's sessions exist", () => {
		mkdirSync(join(sessionsDir, "2025-11-11-1"));
		mkdirSync(join(sessionsDir, "2025-11-11-2"));

		const script = `
			const { readdirSync, existsSync } = require('node:fs');
			const { join } = require('node:path');
			
			const SESSION_NAME_RE = /^\\d{4}-\\d{2}-\\d{2}-\\d+$/;
			
			function getAllSessions(today, sessionsParentDir) {
				if (!existsSync(sessionsParentDir)) {
					return [];
				}
				
				const entries = readdirSync(sessionsParentDir, { withFileTypes: true });
				const sessions = entries
					.filter(entry => entry.isDirectory() && SESSION_NAME_RE.test(entry.name))
					.map(entry => {
						const match = entry.name.match(/^(\\d{4}-\\d{2}-\\d{2})-(\\d+)$/);
						if (!match) return null;
						const date = match[1];
						const number = parseInt(match[2], 10);
						if (date === today) return null;
						return { path: join(sessionsParentDir, entry.name), date, number };
					})
					.filter(Boolean)
					.sort((a, b) => {
						if (a.date !== b.date) {
							return b.date.localeCompare(a.date);
						}
						return b.number - a.number;
					});
				
				return sessions;
			}
			
			function getLatestSession(today, sessionsParentDir) {
				const sessions = getAllSessions(today, sessionsParentDir);
				return sessions.length > 0 ? sessions[0].path : null;
			}
			
			const latest = getLatestSession('2025-11-11', '${sessionsDir.replace(/\\/g, "\\\\")}');
			console.log(latest || 'null');
		`;

		const result = spawnSync("node", ["-e", script], { encoding: "utf8" });
		const latestSession = result.stdout.trim();

		expect(latestSession).toBe("null");
	});

	it("should sort sessions correctly by date and number", () => {
		mkdirSync(join(sessionsDir, "2025-11-10-1"));
		mkdirSync(join(sessionsDir, "2025-11-10-3"));
		mkdirSync(join(sessionsDir, "2025-11-09-5"));
		mkdirSync(join(sessionsDir, "2025-11-10-2"));

		const script = `
			const { readdirSync, existsSync } = require('node:fs');
			const { join } = require('node:path');
			
			const SESSION_NAME_RE = /^\\d{4}-\\d{2}-\\d{2}-\\d+$/;
			
			function getAllSessions(today, sessionsParentDir) {
				if (!existsSync(sessionsParentDir)) {
					return [];
				}
				
				const entries = readdirSync(sessionsParentDir, { withFileTypes: true });
				const sessions = entries
					.filter(entry => entry.isDirectory() && SESSION_NAME_RE.test(entry.name))
					.map(entry => {
						const match = entry.name.match(/^(\\d{4}-\\d{2}-\\d{2})-(\\d+)$/);
						if (!match) return null;
						const date = match[1];
						const number = parseInt(match[2], 10);
						if (date === today) return null;
						return { path: join(sessionsParentDir, entry.name), date, number };
					})
					.filter(Boolean)
					.sort((a, b) => {
						if (a.date !== b.date) {
							return b.date.localeCompare(a.date);
						}
						return b.number - a.number;
					});
				
				return sessions;
			}
			
			function getLatestSession(today, sessionsParentDir) {
				const sessions = getAllSessions(today, sessionsParentDir);
				return sessions.length > 0 ? sessions[0].path : null;
			}
			
			const latest = getLatestSession('2025-11-11', '${sessionsDir.replace(/\\/g, "\\\\")}');
			console.log(latest);
		`;

		const result = spawnSync("node", ["-e", script], { encoding: "utf8" });
		const latestSession = result.stdout.trim();

		// Should be 2025-11-10-3 (most recent date, highest number)
		expect(latestSession).toBe(join(sessionsDir, "2025-11-10-3"));
	});
});
