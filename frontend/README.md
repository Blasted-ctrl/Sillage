# Sillage frontend

React 19, TypeScript and Vite. The active entry point has been restored to the original `src/App.tsx`, with its original `App.css` and `index.css`. The replacement discovery design is no longer mounted.

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run test:e2e
```

The restored frontend runs independently of the API. The cosine recommendation API and model-training improvements remain available; see the [project README](../README.md) for backend setup.

`Discovery.tsx`, `BottleScene.tsx` and `sillage.css` remain as unmounted reference code. They are not imported by the active application and do not affect its appearance or runtime bundle.
