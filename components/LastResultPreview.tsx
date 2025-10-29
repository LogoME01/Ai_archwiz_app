
import React from 'react';
import type { GeneratedOutput } from '../types';
import { Card } from './ui/Card';

interface LastResultPreviewProps {
  lastResult: GeneratedOutput | null;
  onOpenModal: () => void;
}

export const LastResultPreview: React.FC<LastResultPreviewProps> = ({ lastResult, onOpenModal }) => {
  if (!lastResult) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 cursor-pointer transition-all hover:scale-105"
      onClick={onOpenModal}
    >
      <Card className="w-32 h-32 p-1 shadow-2xl overflow-hidden group">
        <img
          src={`data:image/png;base64,${lastResult.outputImage}`}
          alt="Last generated result"
          className="w-full h-full object-cover rounded-md"
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <p className="text-white text-xs text-center">View Result</p>
        </div>
      </Card>
    </div>
  );
};
