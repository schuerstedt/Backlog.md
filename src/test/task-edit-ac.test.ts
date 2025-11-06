import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { $ } from "bun";
import { Core } from "../index.ts";
import { createUniqueTestDir, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Task edit acceptance criteria (--edit-ac)", () => {
	const cliPath = join(process.cwd(), "src", "cli.ts");

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-task-edit-ac");
		await rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
		await mkdir(TEST_DIR, { recursive: true });

		// Initialize git repo first
		await $`git init`.cwd(TEST_DIR).quiet();
		await $`git config user.name "Test User"`.cwd(TEST_DIR).quiet();
		await $`git config user.email "test@example.com"`.cwd(TEST_DIR).quiet();

		// Initialize backlog project using Core
		const core = new Core(TEST_DIR);
		await core.initializeProject("Task Edit AC Test");
	});

	afterEach(async () => {
		try {
			await safeCleanup(TEST_DIR);
		} catch {
			// Ignore cleanup errors - the unique directory names prevent conflicts
		}
	});

	it("should edit a single acceptance criterion", async () => {
		const core = new Core(TEST_DIR);

		// Create task with acceptance criteria
		await core.createTask(
			{
				id: "task-1",
				title: "Test edit single AC",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		// Add acceptance criteria
		await $`bun ${cliPath} task edit 1 --ac "First criterion" --ac "Second criterion" --ac "Third criterion"`
			.cwd(TEST_DIR)
			.quiet();

		// Verify initial state
		let result = await $`bun ${cliPath} task 1 --plain`.cwd(TEST_DIR).text();
		expect(result).toContain("First criterion");
		expect(result).toContain("Second criterion");
		expect(result).toContain("Third criterion");

		// Edit the second criterion
		await $`bun ${cliPath} task edit 1 --edit-ac "2:Updated second criterion"`.cwd(TEST_DIR).quiet();

		// Verify the edit
		result = await $`bun ${cliPath} task 1 --plain`.cwd(TEST_DIR).text();
		expect(result).toContain("First criterion");
		expect(result).toContain("Updated second criterion");
		expect(result).toContain("Third criterion");
		expect(result).not.toContain("Second criterion");
	});

	it("should edit multiple acceptance criteria in one command", async () => {
		const core = new Core(TEST_DIR);

		// Create task with acceptance criteria
		await core.createTask(
			{
				id: "task-2",
				title: "Test edit multiple AC",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		// Add acceptance criteria
		await $`bun ${cliPath} task edit 2 --ac "Original 1" --ac "Original 2" --ac "Original 3"`.cwd(TEST_DIR).quiet();

		// Edit multiple criteria at once
		await $`bun ${cliPath} task edit 2 --edit-ac "1:Updated 1" --edit-ac "3:Updated 3"`.cwd(TEST_DIR).quiet();

		// Verify the edits
		const result = await $`bun ${cliPath} task 2 --plain`.cwd(TEST_DIR).text();
		expect(result).toContain("Updated 1");
		expect(result).toContain("Original 2"); // Should remain unchanged
		expect(result).toContain("Updated 3");
		expect(result).not.toContain("Original 1");
		expect(result).not.toContain("Original 3");
	});

	it("should preserve checked state when editing criterion text", async () => {
		const core = new Core(TEST_DIR);

		// Create task with acceptance criteria
		await core.createTask(
			{
				id: "task-3",
				title: "Test preserve checked state",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		// Add acceptance criteria
		await $`bun ${cliPath} task edit 3 --ac "Unchecked item" --ac "Will be checked" --ac "Another item"`
			.cwd(TEST_DIR)
			.quiet();

		// Check the second criterion
		await $`bun ${cliPath} task edit 3 --check-ac 2`.cwd(TEST_DIR).quiet();

		// Verify it's checked
		let result = await $`bun ${cliPath} task 3 --plain`.cwd(TEST_DIR).text();
		expect(result).toContain("- [x] #2 Will be checked");

		// Edit the checked criterion
		await $`bun ${cliPath} task edit 3 --edit-ac "2:Updated checked item"`.cwd(TEST_DIR).quiet();

		// Verify the text changed but checked state preserved
		result = await $`bun ${cliPath} task 3 --plain`.cwd(TEST_DIR).text();
		expect(result).toContain("- [x] #2 Updated checked item");
		expect(result).not.toContain("Will be checked");
	});

	it("should handle editing criterion with special characters", async () => {
		const core = new Core(TEST_DIR);

		// Create task
		await core.createTask(
			{
				id: "task-4",
				title: "Test special characters",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		// Add a criterion
		await $`bun ${cliPath} task edit 4 --ac "Original text"`.cwd(TEST_DIR).quiet();

		// Edit with special characters
		await $`bun ${cliPath} task edit 4 --edit-ac "1:Updated with special chars: @#$% & 'quotes' and \"double quotes\""`
			.cwd(TEST_DIR)
			.quiet();

		// Verify the edit
		const result = await $`bun ${cliPath} task 4 --plain`.cwd(TEST_DIR).text();
		expect(result).toContain("Updated with special chars: @#$% & 'quotes' and \"double quotes\"");
	});

	it("should error when editing non-existent criterion index", async () => {
		const core = new Core(TEST_DIR);

		// Create task with one criterion
		await core.createTask(
			{
				id: "task-5",
				title: "Test error handling",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		await $`bun ${cliPath} task edit 5 --ac "Only criterion"`.cwd(TEST_DIR).quiet();

		// Try to edit non-existent criterion
		const proc = $`bun ${cliPath} task edit 5 --edit-ac "99:Should fail"`.cwd(TEST_DIR).nothrow();
		const result = await proc;

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Acceptance criterion #99 not found");
	});

	it("should error with invalid format (missing colon)", async () => {
		const core = new Core(TEST_DIR);

		// Create task
		await core.createTask(
			{
				id: "task-6",
				title: "Test invalid format",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		await $`bun ${cliPath} task edit 6 --ac "Criterion"`.cwd(TEST_DIR).quiet();

		// Try invalid format
		const proc = $`bun ${cliPath} task edit 6 --edit-ac "1 Invalid format"`.cwd(TEST_DIR).nothrow();
		const result = await proc;

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("--edit-ac format error");
	});

	it("should error with invalid index (non-numeric)", async () => {
		const core = new Core(TEST_DIR);

		// Create task
		await core.createTask(
			{
				id: "task-7",
				title: "Test invalid index",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		await $`bun ${cliPath} task edit 7 --ac "Criterion"`.cwd(TEST_DIR).quiet();

		// Try non-numeric index
		const proc = $`bun ${cliPath} task edit 7 --edit-ac "abc:Invalid index"`.cwd(TEST_DIR).nothrow();
		const result = await proc;

		expect(result.exitCode).toBe(1);
		expect(result.stderr.toString()).toContain("Invalid acceptance criterion index");
	});

	it("should preserve other sections when editing acceptance criteria", async () => {
		const core = new Core(TEST_DIR);

		// Create task with all sections
		await core.createTask(
			{
				id: "task-8",
				title: "Test section preservation",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Original description",
			},
			false,
		);

		// Add acceptance criteria, plan, and notes
		await $`bun ${cliPath} task edit 8 --ac "Criterion 1" --ac "Criterion 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 8 --plan "Step 1\nStep 2"`.cwd(TEST_DIR).quiet();
		await $`bun ${cliPath} task edit 8 --notes "Implementation notes"`.cwd(TEST_DIR).quiet();

		// Edit acceptance criterion
		await $`bun ${cliPath} task edit 8 --edit-ac "1:Updated criterion 1"`.cwd(TEST_DIR).quiet();

		// Verify all sections preserved
		const result = await $`bun ${cliPath} task 8 --plain`.cwd(TEST_DIR).text();
		expect(result).toContain("Original description");
		expect(result).toContain("Updated criterion 1");
		expect(result).toContain("Criterion 2");
		expect(result).toContain("Step 1");
		expect(result).toContain("Step 2");
		expect(result).toContain("Implementation notes");
	});

	it("should work with plain output flag", async () => {
		const core = new Core(TEST_DIR);

		// Create task
		await core.createTask(
			{
				id: "task-9",
				title: "Test plain output",
				status: "To Do",
				assignee: [],
				createdDate: "2025-11-06",
				labels: [],
				dependencies: [],
				description: "Test task",
			},
			false,
		);

		await $`bun ${cliPath} task edit 9 --ac "Original"`.cwd(TEST_DIR).quiet();

		// Edit with plain output
		const result = await $`bun ${cliPath} task edit 9 --edit-ac "1:Updated with plain" --plain`.cwd(TEST_DIR).text();

		expect(result).toContain("Updated with plain");
		expect(result).toContain("Task task-9");
	});
});
