# Sillage frontend

A blue-and-yellow fragrance studio built with React 19, TypeScript, Vite, Three.js and React Three Fiber. `src/Discovery.tsx` owns the active app. The home page centers an interactive cobalt cologne bottle and a finite mist effect; the pale-blue discovery workbench connects to the local recommendation API.

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run test:e2e
```

Run the API alongside the frontend. Vite forwards `/api` to `http://127.0.0.1:8000`; set the Vite process environment variable `API_PROXY_TARGET` for another local port. For production, provide a same-origin proxy or set `VITE_API_URL` before building. See the [project README](../README.md) for setup.

`tokens.css` defines the ultramarine/lemon palette and local Gloock/Manrope fonts; `base.css` contains shared defaults, and `sillage.css` styles the app. The bottle is a generic Sillage illustration, not a photograph of a recommended product. Mood controls change the query and bottle liquid color. Mist settles after 4.8 seconds; reduced-motion visitors get a static pose. The scene renders on demand and has a fallback if WebGL is unavailable.

The original Vite `App.tsx`, `App.css` and `index.css` remain as legacy reference files, outside the active entry point.
