# Geetanjali Frontend

React application for Geetanjali - Ethical leadership guidance from the Bhagavad Geeta.

## Tech Stack

- **React 18** - UI framework
- **TypeScript 5.6+** - Type safety
- **Vite 7.2** - Build tool and dev server
- **Tailwind CSS 3.x** - Utility-first CSS
- **React Router 7+** - Client-side routing
- **Axios** - HTTP client

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Environment variables:
- `VITE_API_URL` - Backend API base URL (default: http://127.0.0.1:8000)
- `VITE_API_V1_PREFIX` - API version prefix (default: /api/v1)

### Development

```bash
npm run dev
```

Runs the app at http://localhost:5173 with hot module replacement.

### Build

```bash
npm run build
```

Builds optimized production bundle to `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── api/            # API client modules
├── assets/         # Static assets (images, SVGs)
├── components/     # Reusable React components
│   ├── navigation/       # Navigation module
│   │   ├── navConfig.ts      # Routes, labels, icons config
│   │   ├── Navbar.tsx        # Main orchestrator
│   │   ├── DesktopNav.tsx    # Desktop links + auth
│   │   ├── MobileDrawer.tsx  # Mobile slide-out menu
│   │   ├── UserMenu.tsx      # Avatar dropdown
│   │   └── hooks/            # useClickOutside, etc.
│   └── ...
├── contexts/       # React contexts (Auth, etc.)
├── hooks/          # Custom React hooks
├── lib/            # Utilities and services
├── pages/          # Page components (routes)
│   ├── Home.tsx          # Landing page
│   ├── NewCase.tsx       # Case creation form
│   ├── CaseView.tsx      # Case details and conversation
│   ├── Verses.tsx        # Verse browser grid
│   ├── VerseDetail.tsx   # Single verse view
│   ├── ReadingMode.tsx   # Sequential scripture reading
│   └── ...
├── types/          # TypeScript type definitions
├── App.tsx         # Root component with routing
├── main.tsx        # Application entry point
└── index.css       # Global styles and Tailwind directives
```

## Features

### Pages

1. **Home** (`/`) — Landing with value proposition and primary CTA
2. **New Case** (`/cases/new`) — Dilemma submission with optional personalization
3. **Case View** (`/cases/:id`) — Analysis display with follow-up conversation
4. **Cases** (`/consultations`) — User's consultation history
5. **Verses** (`/verses`) — Grid browser with chapter/topic filters
6. **Verse Detail** (`/verses/:id`) — Single verse with translations
7. **Reading Mode** (`/read`) — Sequential scripture study
8. **About** (`/about`) — Mission and methodology

### Components

- **Navigation**: Modular navbar with desktop links, mobile drawer, user menu
- **ProvenancePanel**: Confidence scores, verse citations with canonical IDs
- **OptionTable**: Three options with color-coded pros/cons
- **FloatingActionButton**: Mobile CTA for primary action

### API Integration

Type-safe API client with endpoints:
- `casesApi.create(caseData)` - Create new case
- `casesApi.get(id)` - Get case by ID
- `casesApi.list(skip, limit)` - List user's cases
- `casesApi.analyze(id)` - Trigger RAG analysis
- `outputsApi.get(id)` - Get analysis output
- `outputsApi.listByCaseId(caseId)` - List all outputs for a case
- `outputsApi.scholarReview(id, reviewData)` - Submit scholar review
- `versesApi.search(query)` - Search verses
- `checkHealth()` - Backend health check

All API methods include automatic error handling via axios interceptor.

## Code Quality

- Full TypeScript coverage
- ESLint for code linting
- Prettier-compatible formatting (via Tailwind)
- Type-safe API calls
- Responsive design with Tailwind CSS

## License

MIT
