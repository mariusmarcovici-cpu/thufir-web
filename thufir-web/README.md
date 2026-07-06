# Thufir frontend

Next.js (app router) website for Thufir. Deploys to Vercel.

## Deploy on Vercel
1. Import the GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Add env var `NEXT_PUBLIC_API_URL` = your Railway backend URL (no trailing slash).
4. Deploy.

Then on Railway, add the Vercel URL to the backend's `CORS_ORIGINS` so the
site is allowed to call the API.

## Local dev
    cp .env.local.example .env.local   # edit the URL
    npm install
    npm run dev
