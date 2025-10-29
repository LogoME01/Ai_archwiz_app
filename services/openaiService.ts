/**
 * @fileoverview
 * This file implements the OpenAI API service calls for the ArchAI Studio application.
 * It uses the DALL-E and GPT models to provide text refinement, image generation,
 * and image editing functionalities.
 */
import type { ImageFile } from '../types';

// --- API Configuration & Helpers ---

const getOpenAiApiKey = (): string => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.warn("OPENAI_API_KEY environment variable not set. OpenAI calls will fail.");
    return "";
  }
  return key;
};

const API_KEY = getOpenAiApiKey();

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const IMAGE_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const IMAGE_EDITS_URL = 'https://api.openai.com/v1/images/edits';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const withRetry = async <T,>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> => {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= retries) {
        throw error;
      }
      console.log(`OpenAI API call attempt ${attempt} failed. Retrying in ${initialDelay * Math.pow(2, attempt - 1)}ms...`);
      await delay(initialDelay * Math.pow(2, attempt - 1));
    }
  }
  throw new Error("Exceeded max retries with OpenAI API.");
};

const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
};

// --- Service Implementations ---

export const refineTextPrompt = async (prompt: string, context: string): Promise<string[]> => {
  if (!API_KEY) throw new Error("OpenAI API key is not configured.");

  const styleInstruction = context === "No predefined style"
    ? "Based on the user's prompt, feel free to suggest appropriate and creative architectural styles."
    : `Incorporate the style: "${context}".`;

  const fullPrompt = `You are an expert architectural visualization assistant. Your task is to refine a user's prompt to be more descriptive and evocative for an AI image generator.
${styleInstruction}
User prompt: "${prompt}"
Please provide 3 distinct, creative, and detailed suggestions in a JSON object with a key "suggestions" which is an array of strings. For example: {"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]}`;
  
  const response = await withRetry(() => fetch(CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: fullPrompt }],
      response_format: { type: "json_object" },
      n: 1,
      temperature: 0.7,
    }),
  }));

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  try {
    if (!content) throw new Error("No content from OpenAI.");
    const jsonResponse = JSON.parse(content);
    if (jsonResponse.suggestions && Array.isArray(jsonResponse.suggestions) && jsonResponse.suggestions.length > 0) {
      return jsonResponse.suggestions.slice(0, 3);
    }
    console.warn("Could not parse suggestions from OpenAI, returning raw text.");
    return [content.trim()];
  } catch (e) {
    console.error("Failed to parse suggestions from OpenAI:", e);
    return [content.trim()];
  }
};


export const generateImageFromText = async (prompt: string): Promise<string> => {
  if (!API_KEY) throw new Error("OpenAI API key is not configured.");

  const response = await withRetry(() => fetch(IMAGE_GENERATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
      quality: 'hd',
      style: 'vivid',
    }),
  }));

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const b64_json = data.data[0]?.b64_json;

  if (!b64_json) {
    throw new Error("No image data received from OpenAI API.");
  }

  return b64_json;
};

export const editImage = async (
  baseImage: ImageFile,
  prompt: string,
  overlayImage?: ImageFile | null,
  intensity?: number,
  maskImage?: ImageFile | null
): Promise<string> => {
  if (!API_KEY) throw new Error("OpenAI API key is not configured.");
  
  if (overlayImage) {
    throw new Error("Overlay images are not supported by the OpenAI provider. Please remove the overlay image and try again.");
  }
  
  // The DALL-E 2 edits endpoint is for in-painting and requires a mask.
  if (!maskImage) {
    throw new Error("The OpenAI provider requires a mask for image editing. Please use the 'Guided Edit' mode, draw on the image to create a mask, and provide instructions.");
  }
  
  const formData = new FormData();
  const imageBlob = base64ToBlob(baseImage.base64, baseImage.mimeType);
  const maskBlob = base64ToBlob(maskImage.base64, maskImage.mimeType);

  formData.append('image', imageBlob, 'base_image.png');
  formData.append('mask', maskBlob, 'mask_image.png');
  formData.append('prompt', prompt);
  formData.append('n', '1');
  formData.append('size', '1024x1024'); // DALL-E 2 requires 1024x1024 for edits
  formData.append('response_format', 'b64_json');

  const response = await withRetry(() => fetch(IMAGE_EDITS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: formData,
  }));

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`OpenAI API Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const b64_json = data.data[0]?.b64_json;
  
  if (!b64_json) {
    throw new Error("No image data received from OpenAI API for editing.");
  }
  
  return b64_json;
};