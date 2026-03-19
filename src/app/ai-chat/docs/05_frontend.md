# 05 — Frontend

This document covers the chat UI, state management, and how the frontend communicates with the backend.

---

## File Structure

```
src/app/ai-chat/
├── page.tsx                    # Main chat page (all UI components)
├── stores/
│   └── chat-store.ts           # Zustand state management
├── hooks/
│   └── useUserPrompts.ts       # Hook for saved prompts CRUD
├── docs/
│   └── (these documentation files)
└── globals.css                 # (in src/app/) Print styles + markdown styles
```

---

## The Chat Page (`page.tsx`)

This is a single-file React component that contains the entire chat UI. It's structured as several nested components:

### Component Tree

```
AiChatPage (main page)
├── HistorySidebar
│   ├── "Нов анализ" button
│   ├── ConvStatusIcon (per conversation)
│   └── Conversation list (with delete, tooltip)
│
├── Empty State (when no conversation selected)
│   ├── Built-in SUGGESTIONS cards
│   ├── User-saved prompts (UserPromptCard)
│   ├── "Добави" button → AddPromptDialog
│   └── AddPromptDialog (modal)
│
├── Messages List
│   └── MessageBubble (per message)
│       ├── Avatar (User / Bot)
│       ├── CollapsibleUserMessage (for long prompts)
│       ├── ReactMarkdown (for assistant messages)
│       │   ├── CollapsibleImage (for chart images)
│       │   └── Custom `p` component (avoids div-in-p hydration error)
│       ├── StatusBadge (pending / running / completed / failed)
│       ├── ExportPdfButton → PrintableReport (hidden, for react-to-print)
│       └── FileDownloads (report + chart file links)
│
└── Input Area (textarea + send button)
```

---

## Key UI Components

### `MessageBubble`

Renders a single chat message. The display logic:

```
Is it a user message?
  YES → CollapsibleUserMessage (green bubble, collapses if > 300 chars)
  NO  → Is it running with no content?
          YES → TypingIndicator (animated dots)
          NO  → Render with ReactMarkdown:
                  - StatusBadge (top-left)
                  - ExportPdfButton (top-right, only if completed)
                  - Markdown content (reportMarkdown || message.content)
                  - FileDownloads (bottom)
```

**Content priority:** `message.reportMarkdown || message.content`

- `reportMarkdown` — The full `.md` file fetched from the server (preferred, has charts)
- `content` — The LLM's `final_answer` text (fallback)

### `CollapsibleUserMessage`

For long user prompts (≥ 300 characters):

- Shows first 4 lines with `line-clamp-4`
- "Покажи всичко" button to expand
- "Свий" button to collapse

Short messages render as a plain `<p>`.

### `CollapsibleImage`

Wraps chart images in the markdown report:

- Collapsed by default — shows just the filename/alt text
- Click to expand and see the full image
- Click the image to open in a new tab

### `ExportPdfButton`

Uses `react-to-print` to export the report as PDF:

- Renders a hidden `PrintableReport` component (with `overflow: hidden; height: 0`)
- `PrintableReport` uses its own markdown components (images always expanded, no collapsible wrappers)
- Clicking the button triggers the browser's print dialog → "Save as PDF"

### `AddPromptDialog`

A modal form for creating user-saved prompts:

- Title field + Prompt textarea
- Saves via `useUserPrompts` hook → `POST /api/v1/prompts/`

### `UserPromptCard`

Displays a saved prompt as an amber card:

- Title always visible
- Description clamped to 2 lines, click to expand/collapse
- "Използвай" (Use) button to run the prompt
- Delete button appears on hover

---

## State Management (`chat-store.ts`)

The entire chat state is managed with **Zustand** — a lightweight React state library.

### State Shape

```typescript
interface ChatState {
  conversations: Conversation[]; // All chat conversations
  activeConversationId: string | null; // Currently selected conversation
  isLoading: boolean; // Is an analysis running?
  pollingInterval: ReturnType<typeof setInterval> | null;
}
```

### Conversation & Message Types

```typescript
interface Conversation {
  id: string; // UUID
  title: string; // Truncated user question
  createdAt: string; // ISO timestamp
  messages: ChatMessage[];
  status: "idle" | "running" | "completed" | "failed";
  analysisId?: string; // Backend analysis ID (e.g. "51329fe7")
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string; // LLM's final_answer text
  timestamp: string;
  analysisId?: string;
  status?: "pending" | "running" | "completed" | "failed";
  reportFiles?: string[]; // ["Mill_Report.md"]
  chartFiles?: string[]; // ["chart1.png", "chart2.png"]
  reportMarkdown?: string; // Full markdown content of the report
  error?: string;
}
```

### Key Actions

#### `sendAnalysis(question: string)`

This is the main action triggered when the user submits a prompt:

```
1. createConversation(truncatedTitle)  → new Conversation
2. addMessage({role: "user", content: question})
3. addMessage({role: "assistant", status: "pending"})  → placeholder
4. Set conversation status = "running"
5. POST /api/v1/agentic/analyze {question}
6. Get back analysis_id
7. Store analysisId on the conversation
8. Update assistant message: status = "running"
9. Start polling: pollStatus(analysisId, messageId, convId)
```

#### `pollStatus(analysisId, messageId, convId)`

Polls the backend every 4 seconds:

```
Every 4000ms:
  GET /api/v1/agentic/status/{analysisId}

  If status === "completed":
    - Extract reportFiles and chartFiles
    - Fetch first .md file as reportMarkdown
    - Update assistant message with all data
    - Set conversation status = "completed"
    - Stop polling

  If status === "failed":
    - Update message with error
    - Set conversation status = "failed"
    - Stop polling
```

#### `hydrateFromStorage()`

Loads conversations from `localStorage` after the first client render. This avoids SSR hydration mismatches:

```typescript
// On server: conversations = [] (empty)
// After mount: useEffect → hydrateFromStorage() → loads from localStorage
```

### Persistence

Conversations are saved to `localStorage` under key `"ai-chat-conversations"`:

- **Save:** After every state change (add message, update status, etc.)
- **Load:** On page load via `hydrateFromStorage()`
- **Stuck analyses:** Any conversations with `status: "running"` are reset to `"failed"` on reload (since the background task is gone)

---

## Markdown Rendering

Reports are rendered with `react-markdown` + `remark-gfm` (GitHub Flavored Markdown for tables).

### Custom Components

#### `makeMarkdownComponents(analysisId)`

Factory function that creates custom renderers:

**`p` component:**

- Checks the markdown AST node for image children
- If an image is found → renders `<div>` instead of `<p>` (avoids hydration error since `CollapsibleImage` renders a `<div>`)

**`img` component:**

- Resolves relative image paths to `/api/v1/agentic/reports/{analysisId}/{filename}`
- Wraps in `CollapsibleImage`

### Styling

Markdown content gets the `md-content` CSS class, defined in `globals.css`:

- Tables: bordered cells, alternating row colors, left-aligned headers
- Code blocks: gray background, monospace font
- Headings: proper sizing and spacing
- Lists: standard disc/decimal styling

### Print Styles

For PDF export, `print-report` class in `globals.css` provides:

- Clean typography (11pt body, 18pt h1, 14pt h2)
- Bordered tables with `print-color-adjust: exact`
- Page break avoidance for tables and images

---

## User Prompts (`useUserPrompts` hook)

A custom React hook for CRUD operations on saved prompts:

```typescript
const { prompts, loading, error, createPrompt, deletePrompt } =
  useUserPrompts();
```

**API calls:**

- `GET /api/v1/prompts/` → list all prompts
- `POST /api/v1/prompts/` → create new prompt
- `DELETE /api/v1/prompts/{id}` → delete prompt

Prompts are stored in a SQLite database (`python/prompts.db`) and persist across sessions.

---

## Scroll Behavior

The chat area has nuanced scrolling:

```typescript
useEffect(() => {
  if (conversationChanged) {
    scrollContainerRef.current?.scrollTo({ top: 0 }); // Scroll to top
  } else {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" }); // Scroll to bottom
  }
}, [messages, activeConversationId]);
```

- **Switching conversations:** Scroll to top (so you see the beginning of the report)
- **New message in same conversation:** Smooth scroll to bottom

---

## Next

→ **[06 — Data Flow](./06_data_flow.md)** — Complete end-to-end request lifecycle
