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
├── assets/         # Static assets (images, SVGs)
├── components/     # Reusable React components
│   ├── OptionTable.tsx      # Display options with pros/cons
│   └── ProvenancePanel.tsx  # Show verse sources and confidence
├── lib/            # Utilities and services
│   └── api.ts      # API client with typed endpoints
├── pages/          # Page components (routes)
│   ├── Home.tsx          # Landing page with health check
│   ├── NewCase.tsx       # Case creation form
│   ├── CaseView.tsx      # Case details and analysis
│   └── Verses.tsx        # Verse browsing (placeholder)
├── types/          # TypeScript type definitions
│   └── index.ts    # API response types
├── App.tsx         # Root component with routing
├── main.tsx        # Application entry point
└── index.css       # Global styles and Tailwind directives
```

## Features

### Pages

1. **Home** (`/`)
   - Backend health check with visual status
   - Navigation to case creation and verse browsing
   - Feature overview cards

2. **New Case** (`/cases/new`)
   - Comprehensive form with validation
   - Fields: title, description, role, stakeholders, constraints, horizon, sensitivity
   - Client-side validation with error display
   - Creates case and navigates to analysis view

3. **Case View** (`/cases/:id`)
   - Display case details
   - Trigger RAG analysis
   - Executive summary with confidence meter
   - Three options with pros/cons
   - Recommended action and reflection prompts
   - Scholar flag warnings
   - Provenance panel with verse citations

4. **Verses** (`/verses`)
   - Verse browsing (to be implemented)

### Components

- **ProvenancePanel**: Shows confidence scores, referenced verses with canonical IDs, paraphrases, and school attributions
- **OptionTable**: Displays three options with color-coded pros (green) and cons (red), plus supporting verses

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
