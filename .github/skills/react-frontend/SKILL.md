# SKILL: React Frontend Development

## Overview
Guidelines for developing the React/TypeScript/Tailwind frontend of AI Studio.

## Library Quick Reference

### React Router
```tsx
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'

// Navigation
const navigate = useNavigate()
navigate('/chat/123')

// Route params
const { conversationId } = useParams()
```

### TanStack Query
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Queries
const { data, isLoading, error } = useQuery({
  queryKey: ['models'],
  queryFn: getModels,
})

// Mutations
const queryClient = useQueryClient()
const mutation = useMutation({
  mutationFn: createItem,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
})
```

### Zustand
```tsx
import { create } from 'zustand'

// Define store
const useStore = create<State>((set) => ({
  value: 0,
  setValue: (v: number) => set({ value: v }),
}))

// Use with selector (prevents unnecessary re-renders)
const value = useStore((s) => s.value)
```

### Tailwind CSS 4
- Theme tokens in `src/index.css` under `@theme {}`
- Custom colors: `primary`, `surface`, `surface-dim`, `border`, `text`, `text-secondary`, etc.
- Usage: `bg-primary`, `text-text-secondary`, `border-border`
- Dark mode: automatic via `prefers-color-scheme: dark`

### Lucide Icons
```tsx
import { MessageSquare, Settings, Send } from 'lucide-react'
<MessageSquare className="w-4 h-4" />
```

### Toast Notifications
```tsx
import toast from 'react-hot-toast'
toast.success('Saved!')
toast.error('Something went wrong')
```

## Component Patterns

### Profile-Aware Components
```tsx
const profile = useAppStore((s) => s.profile)
return (
  <div>
    <BasicControls />
    {profile === 'advanced' && <AdvancedControls />}
  </div>
)
```

### API Integration Pattern
```tsx
// In lib/api.ts — centralized API calls
export const getModels = () => request<{ models: Model[] }>('/models')

// In component — use TanStack Query
const { data } = useQuery({ queryKey: ['models'], queryFn: getModels })
```

## Testing
```bash
# Type check
pnpm tsc --noEmit

# Dev server
pnpm dev

# Build
pnpm build
```
