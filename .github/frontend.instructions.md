---
description: "Use for AI Studio frontend work: React routes and pages, Zustand stores, TanStack Query integrations, API client changes, Tailwind styling, and profile-aware normal versus advanced UI. Load the react-frontend skill before editing frontend code."
applyTo: "src-frontend/**"
---

# Frontend Agent — React/TypeScript/Tailwind

## Required Skill
Load `.github/skills/react-frontend/SKILL.md` before frontend implementation work.

## Context
You are working on the AI Studio React frontend (`src-frontend/`). This is a Vite-powered SPA that:
1. Provides a chat interface for llama.cpp models
2. Has two profiles: Normal (simple) and Advanced (power user)
3. Manages models, conversations, presets, and settings
4. Communicates with the Rust backend via REST API + SSE streaming

## Key Files
- `src/main.tsx` — Entry point, providers (QueryClient, Router, Toaster)
- `src/App.tsx` — Route definitions
- `src/components/layout/` — App shell (Layout, Sidebar, TopBar, StatusBar)
- `src/components/chat/` — Chat UI (ChatView, MessageBubble)
- `src/pages/` — Route pages (ChatPage, ModelsPage, SettingsPage)
- `src/stores/` — Zustand state stores
- `src/lib/api.ts` — Backend API client
- `src/lib/utils.ts` — Utility functions
- `src/index.css` — Tailwind theme tokens

## Patterns

### Adding a New Page
1. Create `src/pages/MyPage.tsx` with named export
2. Add route in `App.tsx`
3. Add nav link in `Sidebar.tsx`

### Adding a New Component
1. Create in appropriate directory under `src/components/`
2. Use named export (not default)
3. Use `@/` path alias for imports

### State Management
- **Client state**: Zustand stores in `src/stores/`
- **Server state**: TanStack Query with keys like `['entity-name']`
- Access stores with `useMyStore((s) => s.field)` (selector pattern)

### Profile-Aware UI
```tsx
const profile = useAppStore((s) => s.profile)

// Show advanced controls only in advanced mode
{profile === 'advanced' && <AdvancedControls />}
```

## Styling Rules
- Use Tailwind CSS utility classes
- Custom colors defined in `index.css` @theme block: `primary`, `surface`, `surface-dim`, `border`, `text`, `text-secondary`, `text-muted`, etc.
- Dark mode via `prefers-color-scheme: dark` (automatic)
- Rounded corners: `rounded-lg` for containers, `rounded-2xl` for messages/cards
- Transitions: always add `transition-colors` or `transition-all`
- Icons: Use `lucide-react` for all icons

## Rules
- TypeScript strict mode — avoid `any` in new code
- Use `react-hot-toast` for notifications: `toast.success()`, `toast.error()`
- All API calls through `src/lib/api.ts` — never raw `fetch()` in components
- Run `pnpm tsc --noEmit` after changes to check types
