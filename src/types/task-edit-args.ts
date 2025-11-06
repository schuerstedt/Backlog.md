export interface TaskEditArgs {
	title?: string;
	description?: string;
	status?: string;
	priority?: "high" | "medium" | "low";
	labels?: string[];
	addLabels?: string[];
	removeLabels?: string[];
	assignee?: string[];
	ordinal?: number;
	dependencies?: string[];
	implementationPlan?: string;
	planSet?: string;
	planAppend?: string[];
	planClear?: boolean;
	implementationNotes?: string;
	notesSet?: string;
	notesAppend?: string[];
	notesClear?: boolean;
	acceptanceCriteriaSet?: string[];
	acceptanceCriteriaAdd?: string[];
	acceptanceCriteriaRemove?: number[];
	acceptanceCriteriaEdit?: Array<{ index: number; text: string }>;
	acceptanceCriteriaCheck?: number[];
	acceptanceCriteriaUncheck?: number[];
}

export type TaskEditRequest = TaskEditArgs & { id: string };
