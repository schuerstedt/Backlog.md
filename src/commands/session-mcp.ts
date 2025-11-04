/**
 * Session MCP Command Group - Model Context Protocol CLI commands for backlogsession.
 *
 * This command starts the session MCP server which creates an isolated
 * workspace similar to the CLI wrapper, with custom columns: Plan, Approve, Cancel, Doing, Done
 */

import type { Command } from "commander";
import { createSessionMcpServer } from "../mcp/session-server.ts";

type StartOptions = {
	debug?: boolean;
};

/**
 * Register Session MCP command group with CLI program.
 *
 * @param program - Commander program instance
 */
export function registerSessionMcpCommand(program: Command): void {
	const sessionMcpCmd = program.command("session-mcp");
	registerSessionStartCommand(sessionMcpCmd);

	// Also add the main session-mcp command for convenience
	program
		.command("session-mcp-start")
		.description(
			"Start the session MCP server using stdio transport (creates backlogsession directory with custom columns)",
		)
		.option("-d, --debug", "Enable debug logging", false)
		.action(async (options: StartOptions) => {
			try {
				const server = await createSessionMcpServer(process.cwd(), { debug: options.debug });

				await server.connect();
				await server.start();

				if (options.debug) {
					console.error("BacklogSession MCP server started (stdio transport)");
				}

				const shutdown = async (signal: string) => {
					if (options.debug) {
						console.error(`Received ${signal}, shutting down Session MCP server...`);
					}

					try {
						await server.stop();
						process.exit(0);
					} catch (error) {
						console.error("Error during Session MCP server shutdown:", error);
						process.exit(1);
					}
				};

				process.once("SIGINT", () => shutdown("SIGINT"));
				process.once("SIGTERM", () => shutdown("SIGTERM"));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Failed to start Session MCP server: ${message}`);
				process.exit(1);
			}
		});
}

/**
 * Register 'session-mcp start' command for stdio transport.
 */
function registerSessionStartCommand(sessionMcpCmd: Command): void {
	sessionMcpCmd
		.command("start")
		.description("Start the session MCP server using stdio transport")
		.option("-d, --debug", "Enable debug logging", false)
		.action(async (options: StartOptions) => {
			try {
				const server = await createSessionMcpServer(process.cwd(), { debug: options.debug });

				await server.connect();
				await server.start();

				if (options.debug) {
					console.error("BacklogSession MCP server started (stdio transport)");
				}

				const shutdown = async (signal: string) => {
					if (options.debug) {
						console.error(`Received ${signal}, shutting down Session MCP server...`);
					}

					try {
						await server.stop();
						process.exit(0);
					} catch (error) {
						console.error("Error during Session MCP server shutdown:", error);
						process.exit(1);
					}
				};

				process.once("SIGINT", () => shutdown("SIGINT"));
				process.once("SIGTERM", () => shutdown("SIGTERM"));
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error(`Failed to start Session MCP server: ${message}`);
				process.exit(1);
			}
		});
}
