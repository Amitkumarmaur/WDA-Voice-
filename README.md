<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/41d81f93-f92f-4d05-adb0-0a8e73a1e1b8

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure Supabase Edge Function secret `GEMINI_API_KEY` (Dashboard → Project Settings → Edge Functions → Secrets). **Do not** put `GEMINI_API_KEY` in any `VITE_*` variable — the browser only receives short-lived tokens from `gemini-live-token`.
3. Run the app:
   `npm run dev`
