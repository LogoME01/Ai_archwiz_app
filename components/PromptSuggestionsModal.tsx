import React from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { X } from './Icons';
import { Spinner } from './Spinner';

interface PromptSuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  isLoading: boolean;
}

export const PromptSuggestionsModal: React.FC<PromptSuggestionsModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onSelect,
  isLoading,
}) => {
  if (!isOpen) return null;

  const handleSelectSuggestion = (suggestion: string) => {
    onSelect(suggestion);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card
        className="relative w-full max-w-2xl bg-surface text-text-primary overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <CardTitle>Refined Prompt Suggestions</CardTitle>
          <Button size="icon" variant="ghost" className="absolute top-3 right-3" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner className="h-8 w-8 text-accent" />
              <p className="ml-4">Generating ideas...</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className="p-4 border border-border rounded-lg cursor-pointer hover:bg-accent/10 hover:border-accent transition-colors"
                  onClick={() => handleSelectSuggestion(suggestion)}
                >
                  <p className="text-sm text-text-secondary">{suggestion}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
