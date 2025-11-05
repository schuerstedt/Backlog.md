import React, {useState, useEffect, memo, useCallback} from 'react';
import {useParams, useNavigate, useSearchParams} from 'react-router-dom';
import {apiClient} from '../lib/api';
import MDEditor from '@uiw/react-md-editor';
import {type Document} from '../../types';
import ErrorBoundary from '../components/ErrorBoundary';
import {SuccessToast} from './SuccessToast';
import { useTheme } from '../contexts/ThemeContext';
import { sanitizeUrlTitle } from '../utils/urlHelpers';

// Custom MDEditor wrapper for proper height handling
const MarkdownEditor = memo(function MarkdownEditor({
	value,
	onChange,
	isEditing
}: {
    value: string;
    onChange?: (val: string | undefined) => void;
    isEditing: boolean;
    isReadonly?: boolean;
}) {
    const { theme } = useTheme();
    if (!isEditing) {
        // Preview mode - just show the rendered markdown without editor UI
        return (
            <div
                className="prose prose-sm !max-w-none w-full p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                data-color-mode={theme}>
                <MDEditor.Markdown source={value}/>
            </div>
        );
    }

    // Edit mode - show full editor that fills the available space
    return (
        <div className="h-full w-full flex flex-col">
            <div className="flex-1 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                <MDEditor
                    value={value}
                    onChange={onChange}
                    preview="edit"
                    height="100%"
                    hideToolbar={false}
                    data-color-mode={theme}
                    textareaProps={{
                        placeholder: 'Write your documentation here...',
                        style: {
                            fontSize: '14px',
                            resize: 'none'
                        }
                    }}
                />
            </div>
        </div>
    );
});

// Utility function to add doc prefix for API calls
const addDocPrefix = (id: string): string => {
    return id.startsWith('doc-') ? id : `doc-${id}`;
};

interface DocumentationDetailProps {
    docs: Document[];
    onRefreshData: () => Promise<void>;
}

export default function DocumentationDetail({docs, onRefreshData}: DocumentationDetailProps) {
    const {id, title} = useParams<{ id: string; title: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [document, setDocument] = useState<Document | null>(null);
    const [content, setContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [docTitle, setDocTitle] = useState<string>('');
    const [originalDocTitle, setOriginalDocTitle] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [, setError] = useState<Error | null>(null);
    const [saveError, setSaveError] = useState<Error | null>(null);
    const [isNewDocument, setIsNewDocument] = useState(false);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);

    useEffect(() => {
        if (id === 'new') {
            // Handle new document creation
            setIsNewDocument(true);
            setIsEditing(true);
            setIsLoading(false);
            setDocTitle('');
            setOriginalDocTitle('');
            setContent('');
            setOriginalContent('');
        } else if (id) {
            setIsNewDocument(false);
            setIsEditing(false); // Ensure we start in preview mode for existing documents
            loadDocContent();
        }
    }, [id, docs]);

    // Check for edit query parameter to start in edit mode
    useEffect(() => {
        if (searchParams.get('edit') === 'true') {
            setIsEditing(true);
            // Remove the edit parameter from URL
            setSearchParams(params => {
                params.delete('edit');
                return params;
            });
        }
    }, [searchParams, setSearchParams]);

    const loadDocContent = useCallback(async () => {
        if (!id) return;

        try {
            setIsLoading(true);
            setError(null);
            // Find document from props
            const prefixedId = addDocPrefix(id);
            const doc = docs.find(d => d.id === prefixedId);
            
            // Always try to fetch the document from API, whether we found it in docs or not
            // This ensures deep linking works even before the parent component loads the docs array
            try {
                const fullDoc = await apiClient.fetchDoc(prefixedId);
                setContent(fullDoc.rawContent || '');
                setOriginalContent(fullDoc.rawContent || '');
                setDocTitle(fullDoc.title || '');
                setOriginalDocTitle(fullDoc.title || '');
                // Update document state with full data
                setDocument(fullDoc);
            } catch (fetchError) {
                // If fetch fails and we don't have the doc in props, show error
                if (!doc) {
                    setError(new Error(`Document with ID "${prefixedId}" not found`));
                    console.error('Failed to load document:', fetchError);
                } else {
                    // We have basic info from props even if fetch failed
                    setDocument(doc);
                    setDocTitle(doc.title || '');
                    setOriginalDocTitle(doc.title || '');
                }
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load document');
            setError(error);
            console.error('Failed to load document:', error);
        } finally {
            setIsLoading(false);
        }
    }, [id, docs]);

    const handleSave = useCallback(async () => {
        if (!docTitle.trim()) {
            setSaveError(new Error('Document title is required'));
            return;
        }

        try {
            setIsSaving(true);
            setSaveError(null);
            const normalizedTitle = docTitle.trim();

            if (isNewDocument) {
                // Create new document
                const result = await apiClient.createDoc(normalizedTitle, content);
                // Refresh data and navigate to the new document
                await onRefreshData();
                // Show success toast
                setShowSaveSuccess(true);
                setTimeout(() => setShowSaveSuccess(false), 4000);
                // Exit edit mode and navigate to the new document
                setIsEditing(false);
                setIsNewDocument(false);
                setDocTitle(normalizedTitle);
                setOriginalDocTitle(normalizedTitle);
                // Use the returned document ID for navigation
                const documentId = result.id.replace('doc-', ''); // Remove prefix for URL
                navigate(`/documentation/${documentId}/${sanitizeUrlTitle(normalizedTitle)}`);
            } else {
                // Update existing document
                if (!id) return;

                // Check if title has changed
                const titleChanged = normalizedTitle !== originalDocTitle;

                // Pass title only if it has changed
                await apiClient.updateDoc(
                    addDocPrefix(id),
                    content,
                    titleChanged ? normalizedTitle : undefined
                );

                // Update original title to the new value
                if (titleChanged) {
                    setDocTitle(normalizedTitle);
                    setOriginalDocTitle(normalizedTitle);
                }

                // Refresh data from parent
                await onRefreshData();
                // Show success toast
                setShowSaveSuccess(true);
                setTimeout(() => setShowSaveSuccess(false), 4000);
                // Exit edit mode and navigate to document detail page (this will load in preview mode)
                setIsEditing(false);
                navigate(`/documentation/${id}/${sanitizeUrlTitle(normalizedTitle)}`);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to save document');
            setSaveError(error);
            console.error('Failed to save document:', error);
        } finally {
            setIsSaving(false);
        }
    }, [id, docTitle, content, isNewDocument, onRefreshData, navigate, loadDocContent]);

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        if (isNewDocument) {
            // Navigate back for new documents
            navigate('/documentation');
        } else {
            // Revert changes for existing documents
            setContent(originalContent);
            setDocTitle(originalDocTitle);
            setIsEditing(false);
        }
    };

    const hasChanges = content !== originalContent || docTitle !== originalDocTitle;

    if (!id) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor"
                         viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No document selected</h3>
                    <p className="mt-1 text-sm text-gray-500">Select a document from the sidebar to view its
                        content.</p>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            <div className="h-full bg-white dark:bg-gray-900 flex flex-col transition-colors duration-200">
                {/* Header Section - Confluence/Linear Style */}
                <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors duration-200">
                    <div className="max-w-4xl mx-auto px-8 py-6">
                        <div className="flex items-start justify-between mb-6">
                            <div className="flex-1">
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={docTitle}
                                        onChange={(e) => setDocTitle(e.target.value)}
                                        className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
                                        placeholder="Document title"
                                    />
                                ) : (
                                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2 transition-colors duration-200">
                                        {docTitle || document?.title || (title ? decodeURIComponent(title) : `Document ${id}`)}
                                    </h1>
                                )}
                                <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400 transition-colors duration-200">
                                    <div className="flex items-center space-x-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a.997.997 0 01-1.414 0l-7-7A1.997 1.997 0 013 12V7a4 4 0 014-4z"/>
                                        </svg>
                                        <span>ID: {document?.id || `doc-${id}`}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                        </svg>
                                        <span>Documentation</span>
                                    </div>
                                    {document?.createdDate && (
                                        <div className="flex items-center space-x-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor"
                                                 viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                            </svg>
                                            <span>Created: {document.createdDate}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 ml-6">
                                {!isEditing ? (
                                    <div className="flex items-center space-x-2">
                                        {document?.filePath ? (
                                            <a
                                                href={`vscode://file/${encodeURI((document.filePath || '').replace(/\\\\/g, '/'))}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                title="Open in VS Code"
                                                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer"
                                            >
                                                <svg className="w-5 h-5" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                                    <mask id="vscode-mask-doc" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
                                                        <path fillRule="evenodd" clipRule="evenodd" d="M70.9119 99.3171C72.4869 99.9307 74.2828 99.8914 75.8725 99.1264L96.4608 89.2197C98.6242 88.1787 100 85.9892 100 83.5872V16.4133C100 14.0113 98.6243 11.8218 96.4609 10.7808L75.8725 0.873756C73.7862 -0.130129 71.3446 0.11576 69.5135 1.44695C69.252 1.63711 69.0028 1.84943 68.769 2.08341L29.3551 38.0415L12.1872 25.0096C10.589 23.7965 8.35363 23.8959 6.86933 25.2461L1.36303 30.2549C-0.452552 31.9064 -0.454633 34.7627 1.35853 36.417L16.2471 50.0001L1.35853 63.5832C-0.454633 65.2374 -0.452552 68.0938 1.36303 69.7453L6.86933 74.7541C8.35363 76.1043 10.589 76.2037 12.1872 74.9905L29.3551 61.9587L68.769 97.9167C69.3925 98.5406 70.1246 99.0104 70.9119 99.3171ZM75.0152 27.2989L45.1091 50.0001L75.0152 72.7012V27.2989Z" fill="white"/>
                                                    </mask>
                                                    <g mask="url(#vscode-mask-doc)">
                                                        <path d="M96.4614 10.7962L75.8569 0.875542C73.4719 -0.272773 70.6217 0.211611 68.75 2.08333L1.29858 63.5832C-0.515693 65.2373 -0.513607 68.0937 1.30308 69.7452L6.81272 74.754C8.29793 76.1042 10.5347 76.2036 12.1338 74.9905L93.3609 13.3699C96.086 11.3026 100 13.2462 100 16.6667V16.4275C100 14.0265 98.6246 11.8378 96.4614 10.7962Z" fill="#0065A9"/>
                                                        <g filter="url(#vscode-filter0-doc)">
                                                            <path d="M96.4614 89.2038L75.8569 99.1245C73.4719 100.273 70.6217 99.7884 68.75 97.9167L1.29858 36.4169C-0.515693 34.7627 -0.513607 31.9063 1.30308 30.2548L6.81272 25.246C8.29793 23.8958 10.5347 23.7964 12.1338 25.0095L93.3609 86.6301C96.086 88.6974 100 86.7538 100 83.3334V83.5726C100 85.9735 98.6246 88.1622 96.4614 89.2038Z" fill="#007ACC"/>
                                                        </g>
                                                        <g filter="url(#vscode-filter1-doc)">
                                                            <path d="M75.8578 99.1263C73.4721 100.274 70.6219 99.7885 68.75 97.9166C71.0564 100.223 75 98.5895 75 95.3278V4.67213C75 1.41039 71.0564 -0.223106 68.75 2.08329C70.6219 0.211402 73.4721 -0.273666 75.8578 0.873633L96.4587 10.7807C98.6234 11.8217 100 14.0112 100 16.4132V83.5871C100 85.9891 98.6234 88.1786 96.4586 89.2196L75.8578 99.1263Z" fill="#1F9CF0"/>
                                                        </g>
                                                    </g>
                                                    <defs>
                                                        <filter id="vscode-filter0-doc" x="-8.39411" y="15.8291" width="116.727" height="92.2456" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                                                            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                                                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                                                            <feOffset/>
                                                            <feGaussianBlur stdDeviation="4.16667"/>
                                                            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
                                                            <feBlend mode="overlay" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                                                            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
                                                        </filter>
                                                        <filter id="vscode-filter1-doc" x="60.4167" y="-8.07558" width="47.9167" height="116.151" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                                                            <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                                                            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                                                            <feOffset/>
                                                            <feGaussianBlur stdDeviation="4.16667"/>
                                                            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
                                                            <feBlend mode="overlay" in2="BackgroundImageFix" result="effect1_dropShadow"/>
                                                            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape"/>
                                                        </filter>
                                                    </defs>
                                                </svg>
                                                <span className="sr-only">Open in VS Code</span>
                                            </a>
                                        ) : null}
                                        <button
                                            onClick={handleEdit}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor"
                                                 viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                            </svg>
                                            Edit
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={handleCancelEdit}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={!hasChanges || isSaving}
                                            className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors duration-200 ${
                                                hasChanges && !isSaving
                                                    ? 'bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-700 focus:ring-blue-500 dark:focus:ring-blue-400 cursor-pointer'
                                                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            }`}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor"
                                                 viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M5 13l4 4L19 7"/>
                                            </svg>
                                            {isSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 bg-gray-50 dark:bg-gray-800 transition-colors duration-200 flex flex-col">
                    <div className="flex-1 p-8 flex flex-col min-h-0">
                        <MarkdownEditor
                            value={content}
                            onChange={(val) => setContent(val || '')}
                            isEditing={isEditing}
                        />
                    </div>
                </div>

                {/* Save Error Alert */}
                {saveError && (
                    <div className="border-t border-red-200 bg-red-50 px-8 py-3">
                        <div className="flex items-center space-x-3">
                            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                            </svg>
                            <span className="text-sm text-red-700">Failed to save: {saveError.message}</span>
                            <button
                                onClick={() => setSaveError(null)}
                                className="ml-auto text-red-700 hover:text-red-900"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Save Success Toast */}
            {showSaveSuccess && (
                <SuccessToast
                    message={`Document "${docTitle}" saved successfully!`}
                    onDismiss={() => setShowSaveSuccess(false)}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                    }
                />
            )}
        </ErrorBoundary>
    );
}
