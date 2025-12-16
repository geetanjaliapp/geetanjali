# Geetanjali Frontend

React application for ethical leadership guidance from the Bhagavad Geeta.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.x | UI framework |
| TypeScript | 5.9+ | Type safety |
| Vite | 7.x | Build tool |
| Tailwind CSS | 3.x | Styling |
| React Router | 7.x | Routing |
| Axios | 1.x | HTTP client |
| Vitest | 3.x | Testing |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:5173

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── pages/                  # Route components
│   ├── Home.tsx            # Landing page
│   ├── NewCase.tsx         # Consultation form
│   ├── CaseView.tsx        # Case analysis with follow-up
│   ├── Consultations.tsx   # User's consultation history
│   ├── Verses.tsx          # Verse browser grid
│   ├── VerseDetail.tsx     # Single verse view
│   ├── ReadingMode.tsx     # Sequential scripture reading
│   ├── Search.tsx          # Verse search
│   ├── About.tsx           # Mission and methodology
│   ├── Login.tsx           # Authentication
│   ├── Signup.tsx          # Registration
│   └── NotFound.tsx        # 404 page
│
├── components/             # Reusable components
│   ├── navigation/         # Navbar module
│   │   ├── Navbar.tsx      # Main orchestrator
│   │   ├── DesktopNav.tsx  # Desktop links
│   │   ├── MobileDrawer.tsx # Mobile slide-out
│   │   ├── UserMenu.tsx    # Auth dropdown
│   │   └── navConfig.ts    # Route definitions
│   ├── case/               # Case analysis components
│   │   ├── CaseExchange.tsx    # Conversation view
│   │   ├── CaseHeader.tsx      # Case metadata
│   │   ├── PathsSection.tsx    # Three-path options
│   │   ├── StepsSection.tsx    # Action steps
│   │   ├── FollowUpInput.tsx   # Follow-up form
│   │   └── OutputFeedback.tsx  # Rating/feedback
│   ├── VerseCard.tsx       # Verse display card
│   ├── VerseFocus.tsx      # Reading mode verse display
│   ├── ChapterSelector.tsx # Chapter picker
│   ├── Footer.tsx          # Site footer
│   └── icons.tsx           # SVG icon components
│
├── hooks/                  # Custom hooks
│   ├── useCaseData.ts      # Case fetching/polling
│   ├── useSearch.ts        # Search state management
│   ├── useSwipeNavigation.ts # Touch gestures
│   ├── useAdjacentVerses.ts  # Verse navigation
│   └── useSEO.ts           # Document head management
│
├── lib/                    # Utilities
│   ├── api.ts              # API client (axios)
│   ├── contentFilter.ts    # Client-side moderation
│   ├── sanskritFormatter.ts # Sanskrit text formatting
│   ├── session.ts          # Anonymous session handling
│   ├── config.ts           # Runtime configuration
│   └── monitoring.ts       # Sentry, web vitals
│
├── contexts/               # React contexts
│   └── AuthContext.tsx     # Authentication state
│
├── constants/              # Static data
│   ├── chapters.ts         # Chapter metadata
│   ├── principles.ts       # Consulting principles taxonomy
│   └── translators.ts      # Translator priority
│
├── types/                  # TypeScript definitions
│   └── index.ts            # Shared types
│
├── App.tsx                 # Root component with routing
├── main.tsx                # Entry point
└── index.css               # Tailwind directives, global styles
```

## Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Home | Landing with value proposition |
| `/cases/new` | NewCase | Dilemma submission form |
| `/cases/:id` | CaseView | Analysis with conversation |
| `/consultations` | Consultations | User's case history |
| `/verses` | Verses | Grid browser with filters |
| `/verses/:id` | VerseDetail | Single verse with translations |
| `/read` | ReadingMode | Sequential scripture study |
| `/search` | Search | Multi-strategy search |
| `/about` | About | Mission and methodology |
| `/login` | Login | Sign in |
| `/signup` | Signup | Create account |

## API Integration

Type-safe client in `lib/api.ts`:

```typescript
// Cases
casesApi.create(data)           // Create consultation
casesApi.get(id)                // Get case by ID
casesApi.list(skip, limit)      // List user's cases
casesApi.analyze(id)            // Trigger RAG analysis

// Outputs
outputsApi.get(id)              // Get analysis output
outputsApi.listByCaseId(id)     // List outputs for case
outputsApi.submitFeedback(id, data)

// Verses
versesApi.list(params)          // List with pagination
versesApi.get(id)               // Single verse
versesApi.getTranslations(id)   // Verse translations
versesApi.getDaily()            // Daily featured
versesApi.getRandom()           // Random verse

// Search
searchApi.search(query, params) // Hybrid search

// Auth
authApi.login(email, password)
authApi.signup(email, password, name)
authApi.logout()
authApi.refresh()
```

## Configuration

Environment variables in `.env`:

```bash
VITE_API_URL=http://127.0.0.1:8000
VITE_API_V1_PREFIX=/api/v1
VITE_SENTRY_DSN=https://...@sentry.io/...
```

## Design System

See [docs/design.md](../docs/design.md) for the full design language.

**Typography:**
- Headings: Spectral (serif)
- Body: Source Sans Pro
- Sanskrit: Noto Serif Devanagari

**Colors:**
- Primary action: orange-600
- Surfaces: amber-50, white
- Borders: amber-200

**Breakpoints:**
- `sm:` 640px — Primary responsive
- `lg:` 1024px — Desktop enhancements

## Development

```bash
# Development server with HMR
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Test
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage
```

## Build

```bash
# Production build
npm run build

# Output in dist/
# - index.html
# - assets/*.js (code-split chunks)
# - assets/*.css
```

Served by nginx in production with SPA fallback routing.
