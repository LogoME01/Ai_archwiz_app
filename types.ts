
export interface GeneratedOutput {
  type: 'create' | 'enhance';
  prompt: string;
  style: string;
  resolution?: string;
  inputImage: string | null;
  outputImage: string;
  overlayImage: string | null;
  maskImage: string | null;
  intensity?: number;
}

export interface ImageFile {
  base64: string;
  mimeType: string;
  name: string;
}