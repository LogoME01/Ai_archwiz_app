import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Label } from './ui/Label';
import { Select } from './ui/Select';
import { Textarea } from './ui/Textarea';
import { Wand2 } from './Icons';
import { Spinner } from './Spinner';
import { CREATE_STYLE_OPTIONS, RESOLUTION_OPTIONS } from '../constants';
import * as geminiService from '../services/geminiService';
import * as openaiService from '../services/openaiService';
import { PromptSuggestionsModal } from './PromptSuggestionsModal';

interface CreateTabProps {
  onGenerate: (prompt: string, style: string, resolution: string) => void;
  isLoading: boolean;
  aiProvider: 'gemini' | 'openai';
}

export const CreateTab: React.FC<CreateTabProps> = ({ onGenerate, isLoading, aiProvider }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState(CREATE_STYLE_OPTIONS[0]);
  const [resolution, setResolution] = useState(RESOLUTION_OPTIONS[0]);
  const [isRefining, setIsRefining] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);

  const handleRefinePrompt = async () => {
    if (!prompt) return;
    setIsRefining(true);
    setSuggestions([]);
    setIsSuggestionsModalOpen(true);
    try {
      const refineFn = aiProvider === 'gemini' ? geminiService.refineTextPrompt : openaiService.refineTextPrompt;
      const refinedSuggestions = await refineFn(prompt, style);
      setSuggestions(refinedSuggestions);
    } catch (error) {
      console.error("Failed to refine prompt:", error);
      setIsSuggestionsModalOpen(false);
    } finally {
      setIsRefining(false);
    }
  };

  const handleSelectSuggestion = (suggestion: string) => {
    setPrompt(suggestion);
    setIsSuggestionsModalOpen(false);
  };

  const handleGenerate = () => {
    if (!prompt) return;
    onGenerate(prompt, style, resolution);
  };

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create New Visualization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="e.g., A modern living room overlooking a serene lake at sunset"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              disabled={isLoading}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="style">Architectural Style</Label>
              <Select id="style" value={style} onChange={(e) => setStyle(e.target.value)} disabled={isLoading}>
                {CREATE_STYLE_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolution">Resolution</Label>
              <Select id="resolution" value={resolution} onChange={(e) => setResolution(e.target.value)} disabled={isLoading}>
                 {RESOLUTION_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button variant="secondary" onClick={handleRefinePrompt} disabled={isLoading || isRefining || !prompt} className="w-full sm:w-auto">
              <Wand2 className="mr-2 h-4 w-4" />
              Refine Prompt
            </Button>
            <Button onClick={handleGenerate} disabled={isLoading || !prompt} className="w-full sm:flex-1">
               {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
              Generate Image
            </Button>
          </div>
        </CardContent>
      </Card>
      <PromptSuggestionsModal
        isOpen={isSuggestionsModalOpen}
        onClose={() => setIsSuggestionsModalOpen(false)}
        suggestions={suggestions}
        onSelect={handleSelectSuggestion}
        isLoading={isRefining}
      />
    </>
  );
};
