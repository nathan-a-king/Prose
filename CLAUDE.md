# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Development Server
```bash
npm run dev
```
Starts Vite development server on port 3000 with hot module replacement.

### Production Build
```bash
npm run build
```
Creates optimized production build in `build/` directory with code splitting for vendor and router chunks.

### Production Server
```bash
npm start
```
Runs Express server on port 8080 serving the production build.

## Architecture Overview

This is a React 19 single-page application with the following architecture:

### Routing & Layout
- Uses React Router v7 with client-side routing configured in `src/App.jsx`
- Main layout wrapper at `src/components/layout/Layout.jsx` handles consistent page structure
- Pages are in `src/pages/` directory (HomePage, AboutPage, ContactPage)

### Styling & Theming
- Tailwind CSS with custom configuration including:
  - Dark mode support via `class` strategy
  - Custom primary color palette (blue shades)
  - Custom animations (fade-in, slide-up)
  - Inter font for body text, JetBrains Mono for code
- Theme context at `src/contexts/ThemeContext.jsx` manages dark/light mode state

### Build & Deployment
- Vite handles development and production builds with React plugin
- Production server uses Express to serve static files and handle client-side routing
- Build output configured for `build/` directory with manual chunking for optimization

### Component Organization
- `src/components/layout/` - Layout components
- `src/components/ui/` - Reusable UI components
- `src/contexts/` - React contexts for global state
- `src/pages/` - Page-level components for routes