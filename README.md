# Kreischtech AI Consulting

Secure, Local AI Built for the Jobsite and the Boardroom.

## Project Overview
This website is a Single Page Application (SPA) built with React, TypeScript, and Vite, designed to showcase AI consulting services for the Construction and Engineering industries.

## SEO Implementation
We have implemented a comprehensive SEO strategy using `react-helmet-async`.

### 1. Dynamic Head Management
Each page has its own unique title, description, and keywords managed via the `SEO` component. This ensures that search engines index the specific content of each page.

### 2. Reusable SEO Component
Located at `src/components/SEO.tsx`, this component handles:
- Dynamic Title (appends site name)
- Meta Descriptions
- Keywords
- Open Graph (OG) Tags for Social Media
- Twitter Cards

### 3. Global Meta Tags
Base meta tags and defaults are set in `index.html` to provide high-quality fallback data.

### 4. Structured Data (JSON-LD)
We use JSON-LD structured data on the Landing Page to provide search engines with explicit information about the business.
- **Type**: `ProfessionalService`
- **Focus**: AI Consulting for Construction
- **Location**: Ashtabula, Ohio
- **URL**: https://kreischtech.vercel.app/

### 5. Social Media Presence
Open Graph and Twitter tags are configured with high-quality preview images (Unsplash) to ensure professional visibility when links are shared.

## Development

### Setup
```bash
npm install
```

### Build
```bash
npm run build
```

### Testing
```bash
npm run test
```
