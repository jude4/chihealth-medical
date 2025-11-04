import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runChat, getTriageSuggestion } from './geminiService';

// Mock the entire @google/genai library
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
  const mockGoogleGenAI = vi.fn(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  }));

  return {
    GoogleGenAI: mockGoogleGenAI,
    // We need to export any enums or types used by the service
    Type: {
      OBJECT: 'OBJECT',
      ARRAY: 'ARRAY',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      INTEGER: 'INTEGER',
      BOOLEAN: 'BOOLEAN',
    }
  };
});


describe('geminiService', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runChat', () => {
    it('should call generateContent with the correct model and a formatted prompt', async () => {
      const mockResponse = { text: 'This is a mock response.' };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const userPrompt = 'hello world';
      const result = await runChat(userPrompt);

      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: expect.stringContaining(`The user is asking the following: "${userPrompt}"`),
      });
      
      expect(result).toBe(mockResponse.text);
    });

     it('should return the text from the API response', async () => {
      const expectedText = 'AI says hello!';
      mockGenerateContent.mockResolvedValue({ text: expectedText });
      
      const result = await runChat('anything');
      
      expect(result).toBe(expectedText);
    });
  });
  
  describe('getTriageSuggestion', () => {
    it('should call generateContent with JSON mime type and parse the result', async () => {
      const mockSuggestion = {
        recommendation: 'appointment',
        reasoning: 'Symptoms are moderate.',
        specialty: 'General Practice',
      };
      const mockResponse = { text: JSON.stringify(mockSuggestion) };
      mockGenerateContent.mockResolvedValue(mockResponse);

      const symptoms = 'feeling tired';
      const result = await getTriageSuggestion(symptoms);
      
      expect(mockGenerateContent).toHaveBeenCalledWith({
        model: 'gemini-2.5-flash',
        contents: expect.stringContaining(`"${symptoms}"`),
        config: {
          responseMimeType: 'application/json',
        },
      });

      expect(result).toEqual(mockSuggestion);
    });
    
     it('should return null if the JSON is malformed', async () => {
      const mockResponse = { text: 'this is not json' };
      mockGenerateContent.mockResolvedValue(mockResponse);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await getTriageSuggestion('headache');
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });
  });
});
