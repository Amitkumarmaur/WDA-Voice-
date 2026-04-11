export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.error(
    'Missing Gemini API key. Set VITE_GEMINI_API_KEY or GEMINI_API_KEY in environment variables and rebuild the app.'
  );
}
