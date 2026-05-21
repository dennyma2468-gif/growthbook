# Deploy GrowthBook (share with anyone on mobile data)

`192.168.x.x` only works on the **same WiFi**. For 4G/5G or friends elsewhere, deploy to Vercel (free).

## 1. Push to GitHub

```bash
cd growthbook
git init
git add .
git commit -m "GrowthBook MVP"
# Create repo on github.com, then:
git remote add origin https://github.com/YOUR_USER/growthbook.git
git push -u origin main
```

## 2. Deploy on Vercel

1. https://vercel.com → Sign in with GitHub
2. **Add New Project** → import `growthbook`
3. **Environment Variables** (same as `.env.local`):

| Name | Value |
|------|--------|
| `ANTHROPIC_API_KEY` | your key |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |

4. Deploy → you get `https://growthbook-xxx.vercel.app`

## 3. Share with parents

On the wall page tap **Share link** — copies:

```
https://growthbook-xxx.vercel.app/wall?code=ABC-DEF-GHJ
```

Send that link on WeChat / iMessage. They open it on any phone (no WiFi needed).

## Quick demo without deploy (tunnel)

```bash
npx ngrok http 3000
```

Use the `https://xxxx.ngrok.io` URL — works on mobile data while your PC runs `npm run dev`.
