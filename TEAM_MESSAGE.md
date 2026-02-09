# Team Announcement: imports-detector

**Hi @frontend_team**

I built my first npm package with a CLI tool to help us track down component usage in our FE app — especially those tricky lazy imports and barrel file re-exports.

**imports-detector** finds exactly where modules are imported, including:

- **Lazy imports** — React.lazy(), Next.js dynamic(), even when renamed
- **Barrel files** — Components imported through index.ts re-exports
- **All import types** — static, dynamic, lazy, require
- ✨ **NEW: Find Unused Files** — Identify dead code with a single command
- 📊 **NEW: Import Maps** — Build dependency graphs with statistics

## Example: Find all files using RadioBoxField (including lazy imports)

```bash
npx imports-detector find --module-path src/components/Stats/Components/CardContent.tsx
```

## Example: Find unused components

```bash
npx imports-detector find-unused-files --path ./src
```

## The best part:

It catches lazy imports even when the component is renamed:

```typescript
const LazyHeader = React.lazy(() => import('./Header')); // ✅ Detected
const Dashboard = dynamic(() => import('./admin/Dashboard')); // ✅ Detected
```

## This has been super useful for:

- Finding unused components before removing them
- Understanding what breaks when you refactor
- Tracking lazy-loaded components that get renamed

## Performance:

- ⚡ **1000x faster** than checking files individually
- 💾 **Memory efficient** (~50MB regardless of project size)
- 🧪 **Tested on jisr-frontend** with 8,000+ files (~15 seconds)

Open-source and free to use. Would love your feedback if you try it out!

**We reached 800+ downloads in the first week!** 🎉

## Links:

- **npm package**: https://www.npmjs.com/package/imports-detector
- **GitHub repo**: https://github.com/almaqdi/imports-detector
