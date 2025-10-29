import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageFile } from '../types';
import { ENHANCE_STYLE_OPTIONS } from '../constants';
import * as geminiService from '../services/geminiService';
import * as openaiService from '../services/openaiService';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { Label } from './ui/Label';
import { Select } from './ui/Select';
import { Slider } from './ui/Slider';
import { Textarea } from './ui/Textarea';
import { ImageUpload } from './ImageUpload';
import { Undo2, Wand2, Eraser, X, UploadCloud } from './Icons';
import { Spinner } from './Spinner';
import { PromptSuggestionsModal } from './PromptSuggestionsModal';

interface EnhanceTabProps {
  onProcess: (prompt: string, style: string, intensity: number, overlayImageFile: ImageFile | null, maskImageFile: ImageFile | null) => void;
  isLoading: boolean;
  inputImage: ImageFile | null;
  setInputImage: (file: ImageFile | null) => void;
  overlayImage: ImageFile | null;
  setOverlayImage: (file: ImageFile | null) => void;
  undoHistoryCount: number;
  handleUndo: () => void;
  onError: (message: string) => void;
  aiProvider: 'gemini' | 'openai';
}

type Mode = 'enhance' | 'edit';

export const EnhanceTab: React.FC<EnhanceTabProps> = ({
  onProcess,
  isLoading,
  inputImage,
  setInputImage,
  overlayImage,
  setOverlayImage,
  undoHistoryCount,
  handleUndo,
  onError,
  aiProvider,
}) => {
  const [mode, setMode] = useState<Mode>('enhance');
  const [enhanceStyle, setEnhanceStyle] = useState(Object.keys(ENHANCE_STYLE_OPTIONS)[0]);
  const [editPrompt, setEditPrompt] = useState('');
  const [intensity, setIntensity] = useState(50);
  const [isRefining, setIsRefining] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(40);

  const getIntensityDescription = useCallback(() => {
    if (intensity <= 33) {
      return "Subtle changes, preserving the original image's character.";
    }
    if (intensity <= 66) {
      return "Balanced edit, blending the prompt with the original image.";
    }
    return "Strong transformation, letting the prompt take creative control.";
  }, [intensity]);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext('2d', { willReadFrequently: true });
    } catch (e) {
      console.error('Could not get 2d context', e);
      context = canvas.getContext('2d');
    }

    if (!context) return;

    const setCanvasDimensions = () => {
      canvas.width = image.clientWidth;
      canvas.height = image.clientHeight;
      if(context) {
        context.lineWidth = brushSize;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = 'rgba(198, 166, 100, 0.7)'; // Accent color with opacity
      }
    };

    image.onload = setCanvasDimensions;
    window.addEventListener('resize', setCanvasDimensions);
    if (image.complete) {
      setCanvasDimensions();
    }
    
    clearMask();

    return () => {
      if (image) {
        image.onload = null;
      }
      window.removeEventListener('resize', setCanvasDimensions);
    };
  }, [inputImage, brushSize, clearMask]);

  const getCoords = (e: React.MouseEvent | React.TouchEvent): {x: number, y: number} | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const event = e.nativeEvent;
    const touch = 'touches' in event ? event.touches[0] : null;

    if (touch) {
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    if ('offsetX' in event) {
       return { x: (e as React.MouseEvent).nativeEvent.offsetX, y: (e as React.MouseEvent).nativeEvent.offsetY };
    }
    return null;
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'edit') return;
    const coords = getCoords(e);
    if (!coords) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.beginPath();
    context.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode !== 'edit') return;
    e.preventDefault();
    const coords = getCoords(e);
    if (!coords) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.lineTo(coords.x, coords.y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (mode !== 'edit') return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  };
  
  const getMaskAsImageFile = (): ImageFile | null => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return null;
    
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixelData = imageData.data;
    
    let isMaskEmpty = true;
    for (let i = 3; i < pixelData.length; i += 4) {
      if (pixelData[i] > 0) { // Check alpha channel
        isMaskEmpty = false;
        break;
      }
    }

    if (isMaskEmpty) {
      return null;
    }

    // Create a new canvas for the black and white mask
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const maskContext = maskCanvas.getContext('2d');
    if (!maskContext) return null;

    const newImageData = maskContext.createImageData(canvas.width, canvas.height);
    const data = newImageData.data;

    // Iterate through the original canvas pixels
    for (let i = 0; i < pixelData.length; i += 4) {
        const alpha = pixelData[i + 3]; // Alpha channel
        
        if (alpha > 0) { // If the pixel is not transparent (i.e., it was drawn on)
            data[i] = 255;   // R = White
            data[i + 1] = 255; // G = White
            data[i + 2] = 255; // B = White
        } else {
            data[i] = 0;     // R = Black
            data[i + 1] = 0;   // G = Black
            data[i + 2] = 0;   // B = Black
        }
        data[i + 3] = 255; // A = Opaque
    }

    maskContext.putImageData(newImageData, 0, 0);

    const dataUrl = maskCanvas.toDataURL('image/png');
    return {
      base64: dataUrl.split(',')[1],
      mimeType: 'image/png',
      name: 'mask.png'
    };
  };

  const handleProcess = () => {
    if (!inputImage) return;

    if (mode === 'enhance') {
      const prompt = ENHANCE_STYLE_OPTIONS[enhanceStyle as keyof typeof ENHANCE_STYLE_OPTIONS];
      onProcess(prompt, enhanceStyle, 100, null, null);
    } else {
      if (!editPrompt) return;
      const maskFile = getMaskAsImageFile();
      onProcess(editPrompt, 'Guided Edit', intensity, overlayImage, maskFile);
    }
  };

  const handleRefinePrompt = async () => {
    if (!editPrompt) return;
    setIsRefining(true);
    setSuggestions([]);
    setIsSuggestionsModalOpen(true);
    try {
       const refineFn = aiProvider === 'gemini' ? geminiService.refineTextPrompt : openaiService.refineTextPrompt;
      const refinedSuggestions = await refineFn(
        editPrompt,
        "editing an existing architectural rendering"
      );
      setSuggestions(refinedSuggestions);
    } catch (error) {
      console.error("Failed to refine prompt:", error);
      onError((error as Error).message);
      setIsSuggestionsModalOpen(false);
    } finally {
      setIsRefining(false);
    }
  };
  
  const handleSelectSuggestion = (suggestion: string) => {
    setEditPrompt(suggestion);
    setIsSuggestionsModalOpen(false);
  };

  const handleImageUpload = (file: ImageFile | null) => {
    clearMask();
    setInputImage(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = (error) => reject(error);
        });
        handleImageUpload({
          base64,
          mimeType: file.type,
          name: file.name,
        });
      } catch (error) {
        console.error('Error reading file:', error);
        handleImageUpload(null);
        onError('Failed to read the image file.');
      }
    }
    // Reset file input value to allow re-uploading the same file
    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <>
      <div className="w-full max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
           <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="relative w-full aspect-auto rounded-lg border border-border bg-black/5 overflow-hidden">
            {inputImage ? (
              <>
                <img 
                  ref={imageRef} 
                  src={`data:${inputImage.mimeType};base64,${inputImage.base64}`}
                  alt="Base rendering" 
                  className="w-full h-auto"
                  crossOrigin="anonymous"
                />
                <canvas 
                  ref={canvasRef}
                  className="absolute top-0 left-0"
                  style={{touchAction: 'none', cursor: mode === 'edit' ? 'crosshair' : 'default'}}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="!bg-black/60 hover:!bg-black/80 text-white px-3 h-8"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Change base image"
                  >
                    <UploadCloud className="w-4 h-4 mr-2" />
                    Change
                  </Button>
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="w-8 h-8 !bg-black/60 hover:!bg-black/80" 
                    onClick={() => handleImageUpload(null)}
                    aria-label="Remove base image"
                  >
                    <X className="w-4 h-4 text-white" />
                  </Button>
                </div>
              </>
            ) : (
              <ImageUpload 
                onImageUpload={handleImageUpload} 
                previewImage={null}
                title="Upload Base Rendering"
              />
            )}
          </div>
          <Button onClick={handleUndo} disabled={undoHistoryCount === 0 || isLoading} variant="secondary" className="w-full">
            <Undo2 className="mr-2 h-4 w-4" />
            Undo ({undoHistoryCount})
          </Button>
        </div>

        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex bg-background rounded-lg p-1">
               <button onClick={() => setMode('enhance')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'enhance' ? 'bg-surface shadow' : 'text-text-secondary'}`}>
                  Enhancement
                </button>
                <button onClick={() => setMode('edit')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'edit' ? 'bg-surface shadow' : 'text-text-secondary'}`}>
                  Guided Edit
                </button>
            </div>
            
            {mode === 'enhance' && (
              <div className="space-y-2">
                <Label htmlFor="enhanceStyle">Enhancement Style</Label>
                <Select id="enhanceStyle" value={enhanceStyle} onChange={e => setEnhanceStyle(e.target.value)} disabled={isLoading}>
                  {Object.keys(ENHANCE_STYLE_OPTIONS).map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </Select>
              </div>
            )}

            {mode === 'edit' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="editPrompt">Editing Instructions</Label>
                  <Textarea
                    id="editPrompt"
                    placeholder="e.g., Change the sofa to dark blue velvet, add a modern floor lamp."
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={3}
                    disabled={isLoading}
                  />
                   <Button variant="ghost" size="sm" onClick={handleRefinePrompt} disabled={isLoading || isRefining || !editPrompt}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Refine Instructions
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Overlay Object (Optional)</Label>
                  <div className="relative">
                    <ImageUpload 
                      onImageUpload={setOverlayImage}
                      previewImage={overlayImage?.base64 || null}
                      title="Upload Object"
                    />
                    {overlayImage && (
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="absolute top-2 right-2 w-7 h-7 z-10 !bg-black/60 hover:!bg-black/80" 
                        onClick={(e) => {
                            e.stopPropagation();
                            setOverlayImage(null);
                        }}
                        aria-label="Remove overlay image"
                      >
                        <X className="w-4 h-4 text-white" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="intensity">Modification Intensity</Label>
                    <span className="text-sm font-medium text-accent">{intensity}%</span>
                  </div>
                  <Slider id="intensity" min="1" max="100" value={intensity} onChange={e => setIntensity(Number(e.target.value))} disabled={isLoading}/>
                  <p className="text-xs text-text-secondary">{getIntensityDescription()}</p>
                </div>
                <div className="space-y-4 pt-4 border-t border-border">
                  <Label>Mask Area</Label>
                  <p className="text-xs text-text-secondary">Draw on the image to select an area to edit.</p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="brushSize">Brush Size: {brushSize}</Label>
                    <Slider id="brushSize" min="5" max="100" step="1" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} disabled={isLoading || !inputImage}/>
                  </div>
                   <Button onClick={clearMask} variant="ghost" size="sm" className="w-full" disabled={isLoading || !inputImage}>
                      <Eraser className="mr-2 h-4 w-4" /> Clear Mask
                  </Button>
                </div>
              </div>
            )}

            <Button onClick={handleProcess} disabled={isLoading || !inputImage || (mode === 'edit' && !editPrompt)} className="w-full">
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              Process Image
            </Button>
          </CardContent>
        </Card>
      </div>
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