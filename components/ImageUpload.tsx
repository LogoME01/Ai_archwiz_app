
import React, { useState, useRef, useCallback } from 'react';
import type { ImageFile } from '../types';
import { UploadCloud } from './Icons';

interface ImageUploadProps {
  onImageUpload: (file: ImageFile | null) => void;
  previewImage: string | null;
  title: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, previewImage, title }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (file && file.type.startsWith('image/')) {
      try {
        const base64 = await fileToBase64(file);
        onImageUpload({
          base64,
          mimeType: file.type,
          name: file.name,
        });
      } catch (error) {
        console.error('Error reading file:', error);
        onImageUpload(null);
      }
    }
  }, [onImageUpload]);

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const onAreaClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onClick={onAreaClick}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors
        ${isDragging ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:border-accent/50'}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      {previewImage ? (
        <img src={`data:image/png;base64,${previewImage}`} alt="Preview" className="object-contain w-full h-full rounded-lg" />
      ) : (
        <div className="flex flex-col items-center justify-center text-center p-4">
          <UploadCloud className="w-12 h-12 text-gray-400 mb-2" />
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-text-secondary">Drag & drop or click to upload</p>
        </div>
      )}
    </div>
  );
};
