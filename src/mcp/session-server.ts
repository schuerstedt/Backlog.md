/**
 * MCP Server for BacklogSession - Model Context Protocol server
 *
 * This MCP server creates an isolated session workspace for Backlog.md operations,
 * similar to the CLI wrapper. It creates a backlogsession directory in the current
 * working directory and then delegates all MCP operations to the core functionality
 * within that session.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getPackageName } from "../utils/app-info.ts";
import { getVersion } from "../utils/version.ts";
import { McpServer } from "./server.ts";
import { registerWorkflowResources } from "./resources/workflow/index.ts";
import { registerTaskTools } from "./tools/tasks/index.ts";

/**
 * Create the session directory in the current working directory
 */
function ensureSessionDirectory(cwd: string): string {
	const sessionDir = join(cwd, "backlogsession");
	if (!existsSync(sessionDir)) {
		mkdirSync(sessionDir, { recursive: true });
	}
	return sessionDir;
}

const APP_NAME = `${getPackageName()}-session`;
const APP_VERSION = await getVersion();
const INSTRUCTIONS_POINTER =
	"At the beginning of each session, read the backlog://workflow/overview resource to understand when and how to use Backlog.md for task management. Additional detailed guides are available as resources when needed. This session version uses the backlogsession wrapper which isolates operations to a dedicated session directory with custom columns: Plan, Approve, Cancel, Doing, Done.";

type ServerInitOptions = {
	debug?: boolean;
};

/**
 * Session MCP Server extends the base McpServer but uses an isolated session directory.
 * This provides the same functionality as the regular MCP server but within a controlled workspace.
 */
export class SessionMcpServer extends McpServer {
	constructor(projectRoot: string) {
		// Create and use the session directory
		const sessionDir = ensureSessionDirectory(projectRoot);
		super(sessionDir, INSTRUCTIONS_POINTER);

		// Register workflow resources after construction
		registerWorkflowResources(this);
	}
}

/**
 * Factory that bootstraps a fully configured session MCP server instance.
 */
export async function createSessionMcpServer(
	projectRoot: string,
	options: ServerInitOptions = {},
): Promise<SessionMcpServer> {
	const server = new SessionMcpServer(projectRoot);

	await server.ensureConfigLoaded();

	const config = await server.filesystem.loadConfig();
	if (!config) {
		throw new Error("Failed to load backlog configuration");
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
