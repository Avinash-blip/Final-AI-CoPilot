import React from 'react';

interface QuickSuggestionsProps {
    onSelect: (question: string) => void;
}

const SUGGESTIONS = [
    "Who is the most popular transporter?",
    "Show me delayed trips for last week",
    "What is the average transit time?",
    "List top 5 routes by volume",
];

export const QuickSuggestions: React.FC<QuickSuggestionsProps> = ({ onSelect }) => {
    return (
        <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map((question, index) => (
                <button
                    key={index}
                    onClick={() => onSelect(question)}
                    className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-full transition-colors border border-gray-600"
                >
                    {question}
                </button>
            ))}
        </div>
    );
};
