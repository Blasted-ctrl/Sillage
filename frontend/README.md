# Sillage frontend

React 19, TypeScript, Vite, Three.js and React Three Fiber. The application entry point is `src/Discovery.tsx`; starter files remain as reference.

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run test:e2e
```

Run the API alongside the app. Vite proxies `/api` to `http://127.0.0.1:8000`; set the Vite process environment variable `API_PROXY_TARGET` to use a different local port. For production, configure a same-origin reverse proxy or set `VITE_API_URL` before building. See the [project README](../README.md) for complete setup and test prerequisites.

The 3D bottle is a generic Sillage illustration, not a product photograph or a model of a specific recommended fragrance. Its displayed notes illustrate a scent pyramid; actual recommendations use the catalogue metadata shown in each result.
