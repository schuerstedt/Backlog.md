import React, { useMemo, useState } from "react";

interface LabelFilterDropdownProps {
	availableLabels: string[];
	selectedLabels: string[];
	onChange: (labels: string[]) => void;
	buttonLabel?: string;
	className?: string;
}

const normalize = (value: string) => value.trim();

const LabelFilterDropdown: React.FC<LabelFilterDropdownProps> = ({
	availableLabels,
	selectedLabels,
	onChange,
	buttonLabel = "Filter labels",
	className,
}) => {
	const [isOpen, setIsOpen] = useState(false);

	const emitChange = (labels: string[]) => {
		const normalized = Array.from(
			new Set(labels.map(normalize).filter((value) => value.length > 0)),
		).sort((a, b) => a.localeCompare(b));
		onChange(normalized);
	};

	const options = useMemo(() => {
		const unique = new Set<string>();
		for (const label of availableLabels) {
			const normalized = normalize(label);
			if (normalized.length > 0) {
				unique.add(normalized);
			}
		}
		return Array.from(unique).sort((a, b) => a.localeCompare(b));
	}, [availableLabels]);

	const normalizedSelected = useMemo(() => selectedLabels.map((label) => label.trim()), [selectedLabels]);

	const toggleLabel = (label: string) => {
		const normalized = normalize(label);
		if (normalized.length === 0) return;

		if (normalizedSelected.includes(normalized)) {
			const next = normalizedSelected.filter((item) => item !== normalized);
			emitChange(next);
		} else {
			emitChange([...normalizedSelected, normalized]);
		}
	};

	const handleClear = () => {
		emitChange([]);
	};

	if (options.length === 0) {
		return null;
	}

	const summaryLabel =
		normalizedSelected.length === 0 ? buttonLabel : `${buttonLabel} (${normalizedSelected.length})`;

	return (
		<div className={`relative ${className ?? ""}`}>
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				className="w-full py-2 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer flex items-center justify-between gap-2"
				title="Filter tasks by labels"
			>
				<span className="truncate">{summaryLabel}</span>
				<svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
					<path
						fillRule="evenodd"
						d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
						clipRule="evenodd"
					/>
				</svg>
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-2 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-20">
					<div className="max-h-64 overflow-y-auto p-2 space-y-1">
						{options.map((label) => {
							const checked = normalizedSelected.includes(label);
							return (
								<label
									key={label}
									className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
								>
									<input
										type="checkbox"
										className="h-4 w-4 accent-blue-500"
										checked={checked}
										onChange={() => toggleLabel(label)}
									/>
									<span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
								</label>
							);
						})}
					</div>
					<div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-3 py-2">
						<button
							type="button"
							onClick={handleClear}
							className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
						>
							Clear
						</button>
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="text-sm text-gray-600 dark:text-gray-300 hover:underline"
						>
							Close
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default LabelFilterDropdown;
