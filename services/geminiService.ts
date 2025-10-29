import { GoogleGenAI, Modality, Part, GenerateContentResponse, Type } from "@google/genai";
import type { ImageFile } from '../types';

const API_KEY = process.env.API_KEY || "";

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Using an empty key.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const fileToGenerativePart = (file: ImageFile): Part => {
  return {
    inlineData: {
      data: file.base64,
      mimeType: file.mimeType,
    },
  };
};

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
      console.log(`Attempt ${attempt} failed. Retrying in ${initialDelay * Math.pow(2, attempt - 1)}ms...`);
      await delay(initialDelay * Math.pow(2, attempt - 1));
    }
  }
  throw new Error("Exceeded max retries");
};

export const refineTextPrompt = async (prompt: string, context: string): Promise<string[]> => {
  const styleInstruction = context === "No predefined style"
    ? "Based on the user's prompt, feel free to suggest appropriate and creative architectural styles."
    : `Incorporate the style: "${context}".`;
    
  const fullPrompt = `You are an expert architectural visualization assistant. Your task is to refine a user's prompt to be more descriptive and evocative for an AI image generator.
${styleInstruction}
User prompt: "${prompt}"
Please provide 3 distinct, creative, and detailed suggestions.`;

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: fullPrompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            description: "A list of 3 refined prompt suggestions.",
            items: {
              type: Type.STRING
            }
          }
        },
        required: ['suggestions']
      },
    }
  }));

  try {
    const jsonResponse = JSON.parse(response.text);
    if (jsonResponse.suggestions && Array.isArray(jsonResponse.suggestions) && jsonResponse.suggestions.length > 0) {
      return jsonResponse.suggestions.slice(0, 3);
    }
    console.warn("Could not parse suggestions from Gemini, returning raw text.");
    return [response.text.trim()]; 
  } catch (e) {
    console.error("Failed to parse suggestions from Gemini:", e);
    return [response.text.trim()];
  }
};


export const generateImageFromText = async (prompt: string): Promise<string> => {
  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const firstPart = response.candidates?.[0]?.content?.parts?.[0];
  if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
    return firstPart.inlineData.data;
  }
  
  throw new Error("No image data received from API. The request may have been blocked due to safety policies.");
};

export const editImage = async (
  baseImage: ImageFile,
  prompt: string,
  overlayImage?: ImageFile | null,
  intensity?: number,
  maskImage?: ImageFile | null
): Promise<string> => {
  const parts: Part[] = [];

  if (maskImage) {
    // In-painting/Masked edit prompt
    parts.push({
      text: `You are a precise in-painting AI assistant. Your task is to edit an image only within a specified area defined by a mask.
- You will be given a base image and a corresponding mask image.
- The mask image is black and white. You MUST ONLY edit the pixels in the base image that correspond to the WHITE areas in the mask.
- The BLACK areas of the mask indicate parts of the image that MUST NOT be changed under any circumstances.
- You will then be given a text prompt describing the change to make.

Here is the base image:`,
    });
    parts.push(fileToGenerativePart(baseImage));
    parts.push({ text: "And here is the mask. Remember: ONLY edit the white areas." });
    parts.push(fileToGenerativePart(maskImage));

    if (overlayImage) {
      parts.push({
        text: "You are also provided with an overlay image. Integrate this object into the white masked area according to the prompt.",
      });
      parts.push(fileToGenerativePart(overlayImage));
    }
    
    parts.push({ text: `Now, apply the following instruction to the white masked area of the base image: "${prompt}"` });

  } else {
    // General image editing prompt (no mask)
    parts.push({ text: "You are an expert image editor. Edit the following image based on the text prompt." });
    parts.push(fileToGenerativePart(baseImage));
    
    if (overlayImage) {
      parts.push({
        text: "Integrate this overlay object into the scene, following the text instructions.",
      });
      parts.push(fileToGenerativePart(overlayImage));
    }
    
    let instructionText = `Editing instructions: "${prompt}".`;
    if (intensity) {
      instructionText += ` The modification intensity should be around ${intensity}%.`;
    }
    parts.push({ text: instructionText });
  }

  const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: parts },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const firstPart = response.candidates?.[0]?.content?.parts?.[0];
  if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
    return firstPart.inlineData.data;
  }
  
  throw new Error("No image data received from API. The request may have been blocked due to safety policies.");
};