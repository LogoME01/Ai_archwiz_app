
import React from 'react';
import type { GeneratedOutput } from '../types';
import { Button } from './ui/Button';
import { Card, CardContent } from './ui/Card';
import { ImageCompare } from './ImageCompare';
import { Download, RotateCw, X, Wand2 } from './Icons';

interface ResultViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: GeneratedOutput | null;
  onRegenerate: () => void;
  onContinueEditing: () => void;
  onSendToEnhance: () => void;
}

const downloadImage = (base64Image: string, filename: string) => {
  const link = document.createElement('a');
  link.href = `data:image/png;base64,${base64Image}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const ResultViewerModal: React.FC<ResultViewerModalProps> = ({
  isOpen,
  onClose,
  result,
  onRegenerate,
  onContinueEditing,
  onSendToEnhance,
}) => {
  if (!isOpen || !result) return null;

  const { type, inputImage, outputImage, prompt, overlayImage, maskImage } = result;
  const isEnhance = type === 'enhance' && inputImage;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card
        className="relative w-full max-w-6xl h-[90vh] bg-surface-dark text-text-inverse overflow-hidden flex flex-col lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <Button size="icon" variant="ghost" className="absolute top-2 right-2 z-10 text-white hover:bg-white/20" onClick={onClose}>
            <X className="h-6 w-6" />
        </Button>
        
        <div className="flex-1 bg-black flex items-center justify-center p-4 h-2/3 lg:h-full">
            {isEnhance ? (
                <ImageCompare beforeImage={`data:image/png;base64,${inputImage}`} afterImage={`data:image/png;base64,${outputImage}`} />
            ) : (
                <img src={`data:image/png;base64,${outputImage}`} alt="Generated result" className="max-w-full max-h-full object-contain"/>
            )}
        </div>
        
        <div className="w-full lg:w-80 border-t lg:border-l border-gray-700 p-6 flex flex-col space-y-4 overflow-y-auto h-1/3 lg:h-full">
            <h3 className="text-xl font-serif text-accent">Result Details</h3>
            
            <div className="text-sm space-y-2 flex-1">
                <p className="font-semibold text-gray-300">Prompt:</p>
                <p className="text-gray-400 text-xs bg-black/30 p-2 rounded-md max-h-40 overflow-y-auto">{prompt}</p>
                {overlayImage && (
                    <>
                        <p className="font-semibold text-gray-300 pt-2">Overlay Image:</p>
                        <img src={`data:image/png;base64,${overlayImage}`} alt="Overlay used" className="rounded-md w-24 h-24 object-cover" />
                    </>
                )}
                {maskImage && (
                    <>
                        <p className="font-semibold text-gray-300 pt-2">Mask Used:</p>
                        <img src={`data:image/png;base64,${maskImage}`} alt="Mask used" className="rounded-md w-24 h-24 object-contain bg-gray-900 border border-gray-700" />
                    </>
                )}
            </div>

            <div className="space-y-2">
                <Button onClick={() => downloadImage(outputImage, 'archai_result.png')} variant="primary" className="w-full">
                    <Download className="mr-2 h-4 w-4"/> Download Result
                </Button>
                 {isEnhance && (
                    <Button onClick={() => downloadImage(inputImage, 'archai_original.png')} variant="secondary" className="w-full">
                        <Download className="mr-2 h-4 w-4"/> Download Original
                    </Button>
                )}
                <Button onClick={onRegenerate} variant="secondary" className="w-full">
                    <RotateCw className="mr-2 h-4 w-4"/> Regenerate (Redo)
                </Button>
                {type === 'create' && (
                    <Button onClick={onSendToEnhance} variant="secondary" className="w-full">
                        <Wand2 className="mr-2 h-4 w-4"/> Send to Enhance / Edit
                    </Button>
                )}
                {isEnhance && (
                    <Button onClick={onContinueEditing} variant="secondary" className="w-full">
                        Continue Editing with Result
                    </Button>
                )}
            </div>
        </div>
      </Card>
    </div>
  );
};
