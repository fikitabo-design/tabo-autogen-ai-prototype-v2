
import { GoogleGenAI, Type } from "@google/genai";
import { Asset, Platform, Metadata } from "../types";
import { SHUTTERSTOCK_CATEGORIES } from "../constants";

const fileToGenerativePart = async (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface EngineContext {
  engine: 'gemini' | 'groq';
  groqKey?: string;
}

export const generateAssetMetadata = async (
  asset: Asset,
  platform: Platform,
  context: EngineContext
): Promise<Metadata> => {
  const isTeepublic = platform === 'Teepublic';
  const isShutterstock = platform === 'Shutterstock';
  
  const prompt = `
    You are a high-level Stock Media Strategist. Your goal is to generate metadata that is 100% ACCURATE to the visual content provided. 
    Do NOT guess. Analyze the actual image data carefully.

    ASSET INFO:
    - Filename: ${asset.name}
    - Type: ${asset.type}
    - Platform: ${platform}

    INSTRUCTIONS:
    1. VISUAL ANALYSIS: Look at the main subject, background, lighting, and colors.
    2. TITLE (Max 120 chars): A literal, descriptive sentence of what is visible. Avoid adjectives like "amazing" or "beautiful". Use specific nouns.
    3. DESCRIPTION (Max 200 chars): Explain the scene in a way that someone searching for this exact content would find useful. Include technical details if relevant (e.g., "flat vector design", "high contrast photo").
    4. KEYWORDS (EXACTLY 49): Use highly specific, niche-focused keywords. 
       - Hierarchy: Main subject -> Environment -> Style -> Conceptual/Mood -> Technical specs.
       - No duplicates. No broad generic fillers.
    ${isTeepublic ? '5. TEEPUBLIC: Select a single, extremely relevant "Main Tag" that summarizes the core niche.' : ''}
    ${isShutterstock ? `6. SHUTTERSTOCK: You MUST select the two most accurate categories from this list: ${SHUTTERSTOCK_CATEGORIES.join(', ')}. Ensure they represent the visual genre.` : ''}

    STRICT JSON OUTPUT:
    { 
      "title": "string", 
      "description": "string", 
      "keywords": "k1, k2, ..., k49", 
      "mainTag": "string"${isShutterstock ? ', "category1": "CategoryName", "category2": "CategoryName"' : ''} 
    }
  `;

  if (context.engine === 'groq') {
    if (!context.groqKey) throw new Error("Groq API Key missing");
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${context.groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an expert metadata AI. Output raw JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "Groq API Error");
    }

    const json = await response.json();
    const data = JSON.parse(json.choices[0].message.content);
    return sanitizeMetadata(data, platform);

  } else {
    // Gemini 3 Flash for Vision Tasks
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        keywords: { type: Type.STRING },
        mainTag: { type: Type.STRING },
        category1: { type: Type.STRING },
        category2: { type: Type.STRING },
      },
      required: ["title", "description", "keywords"],
    };

    const parts: any[] = [{ text: prompt }];

    // CRITICAL: Provide the image data to Gemini for visual analysis
    if (asset.type !== 'Video' && asset.file.type.startsWith('image/')) {
      const base64Data = await fileToGenerativePart(asset.file);
      parts.push({
        inlineData: {
          mimeType: asset.file.type,
          data: base64Data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Lower temperature for higher accuracy/factuality
      },
    });

    const data = JSON.parse(response.text || "{}");
    return sanitizeMetadata(data, platform);
  }
};

const sanitizeMetadata = (data: any, platform: Platform): Metadata => {
  const isTeepublic = platform === 'Teepublic';
  const isShutterstock = platform === 'Shutterstock';
  
  let kw = (data.keywords || "").split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  
  // Guarantee exactly 49 keywords
  if (kw.length > 49) {
    kw = kw.slice(0, 49);
  } else if (kw.length < 49 && kw.length > 0) {
    const originalCount = kw.length;
    for (let i = 0; kw.length < 49; i++) {
      kw.push(`${kw[i % originalCount]}_concept`); // Safe padding
    }
  }
  
  return {
    title: (data.title || "Untitled Stock Asset").substring(0, 120),
    description: (data.description || "High quality commercial stock asset for creative projects.").substring(0, 200),
    keywords: kw.join(', '),
    mainTag: isTeepublic ? (data.mainTag || kw[0] || "graphic") : (data.mainTag || kw[0] || ""),
    category1: isShutterstock ? (SHUTTERSTOCK_CATEGORIES.includes(data.category1) ? data.category1 : SHUTTERSTOCK_CATEGORIES[0]) : undefined,
    category2: isShutterstock ? (SHUTTERSTOCK_CATEGORIES.includes(data.category2) ? data.category2 : SHUTTERSTOCK_CATEGORIES[1]) : undefined,
  };
};

export const editImageAsset = async (asset: Asset, editPrompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const base64Data = await fileToGenerativePart(asset.file);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: asset.file.type } },
        { text: editPrompt }
      ]
    }
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data returned from AI editor");
};
