/**
 * MCP Server for BacklogSession - Model Context Protocol server
 *
 * This MCP server creates an isolated session workspace for Backlog.md operations,
 * similar to the CLI wrapper. It creates a backlogsession directory in the current
 * working directory and then delegates all MCP operations to the core functionality
 * within that session.
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPackageName } from "../utils/app-info.ts";
import { getVersion } from "../utils/version.ts";
import { registerWorkflowResources } from "./resources/workflow/index.ts";
import { McpServer } from "./server.ts";
import { registerTaskTools } from "./tools/tasks/index.ts";

/**
 * Get all session directories for today
 */
function getTodaysSessions(parentDir: string, today: string): string[] {
	if (!existsSync(parentDir)) {
		return [];
	}

	const entries = readdirSync(parentDir, { withFileTypes: true });
	const todaySessions = entries
		.filter((entry) => entry.isDirectory() && entry.name.startsWith(`${today}-`))
		.map((entry) => {
			const match = entry.name.match(new RegExp(`^${today.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`));
			if (!match || !match[1]) return null;
			return { path: join(parentDir, entry.name), number: Number.parseInt(match[1], 10) };
		})
		.filter((s): s is { path: string; number: number } => s !== null)
		.sort((a, b) => a.number - b.number);

	return todaySessions.map((s) => s.path);
}

/**
 * Get the last (highest numbered) session for today
 */
function getLastSessionForToday(parentDir: string, today: string): string | null {
	const sessions = getTodaysSessions(parentDir, today);
	const lastSession = sessions[sessions.length - 1];
	return lastSession ?? null;
}

/**
 * Create a new session directory for today with the next consecutive number
 */
function createNewSessionForToday(parentDir: string, today: string): string {
	const sessions = getTodaysSessions(parentDir, today);
	const nextNumber = sessions.length + 1;
	const newSessionDir = join(parentDir, `${today}-${nextNumber}`);
	mkdirSync(newSessionDir, { recursive: true });
	return newSessionDir;
}

/**
 * Ensure session directory exists and return the appropriate session for today.
 * Creates parent directory if needed, then returns the last session for today
 * or creates a new one if none exists.
 */
function ensureSessionDirectory(cwd: string): string {
	const sessionsParentDir = join(cwd, "backlogsession");
	if (!existsSync(sessionsParentDir)) {
		mkdirSync(sessionsParentDir, { recursive: true });
	}

	const todayDate = new Date().toISOString().split("T")[0];
	if (!todayDate) {
		throw new Error("Failed to get today's date");
	}
	const today: string = todayDate;

	let sessionDir = getLastSessionForToday(sessionsParentDir, today);

	if (!sessionDir) {
		// No session exists for today - create the first one
		sessionDir = createNewSessionForToday(sessionsParentDir, today);
	}

	return sessionDir;
}

const APP_NAME = `${getPackageName()}-session`;
const APP_VERSION = await getVersion();
const INSTRUCTIONS_POINTER =
	"At the beginning of each session, read the backlog://workflow/overview resource to understand when and how to use Backlog.md for task management. Additional detailed guides are available as resources when needed. This session version isolates operations to daily session directories (backlogsession/YYYY-MM-DD-N/) with custom columns: Plan, Approve, Cancel, Doing, Done. Multiple sessions can be created per day.";

type ServerInitOptions = {
	debug?: boolean;
};

/**
 * Session MCP Server extends the base McpServer but uses an isolated session directory.
 * This provides the same functionality as the regular MCP server but within a controlled workspace.
 */
export class SessionMcpServer extends McpServer {
	public readonly sessionDir: string;

	constructor(projectRoot: string) {
		// Create and use the session directory
		const sessionDir = ensureSessionDirectory(projectRoot);
		super(sessionDir, INSTRUCTIONS_POINTER);

		this.sessionDir = sessionDir;

		// Register workflow resources after construction
		registerWorkflowResources(this);
	}
}

/**
 * Factory that bootstraps a fully configured session MCP server instance.
 * Creates a new session for today if none exists, or reuses existing session.
 */
export async function createSessionMcpServer(
	projectRoot: string,
	options: ServerInitOptions = {},
): Promise<SessionMcpServer> {
	const server = new SessionMcpServer(projectRoot);

	await server.ensureConfigLoaded();

	let config = await server.filesystem.loadConfig();

	// If no config exists, initialize the session
	if (!config) {
		// Extract session identifier from session directory path
		// e.g., "backlogsession/2025-11-04-1" -> "2025-11-04-1"
		const sessionName = server.sessionDir.split(/[/\\]/).pop() || "Session";
		await server.initializeProject(`Session ${sessionName}`);
		config = await server.filesystem.loadConfig();

		if (!config) {
			throw new Error("Failed to initialize session configuration");
		}
	}

	// Apply custom column configuration for the session (Plan, Approve, Cancel, Doing, Done)
	config.statuses = ["Plan", "Approve", "Cancel", "Doing", "Done"];
	// Save the updated config
	await server.filesystem.saveConfig(config);

	registerTaskTools(server, config);

	if (options.debug) {
		console.error("BacklogSession MCP server initialised (stdio transport only).");
	}

	return server;
}
