# NutriTrack

A nutrition tracking application built with Next.js, TypeScript, and Supabase.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)

## Overview

A web application for tracking nutrition and meals, built with modern web technologies.

### Features

- **User Authentication**: Email/password signup and login with Supabase Auth
- **Guest Mode**: Browse and search foods without creating an account
- **Food Search**: Search for foods using the USDA Food Database
- **Meal Tracking**: Add foods to meals (breakfast, lunch, dinner, snacks)
- **Nutrition Information**: View detailed nutritional information for foods
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS

### Tech Stack

- **Frontend**: Next.js 15 with App Router, React 18, TypeScript
- **Backend**: Supabase (PostgreSQL database, authentication, real-time)
- **Styling**: Tailwind CSS with Radix UI components
- **API Integration**: USDA Food Database API
- **Deployment**: Vercel

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd meal-app-react
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these values from your [Supabase Dashboard](https://supabase.com/dashboard):

- Go to **Settings** → **API**
- Copy the **Project URL** and **anon public** key

### 4. Supabase Setup

Set up your Supabase project with the required tables and authentication settings.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
meal-app-react/
├── app/                     # Next.js App Router
│   ├── auth/               # Authentication pages
│   ├── dashboard/          # Dashboard and meal tracking
│   ├── food-details/       # Food detail pages
│   ├── landing/            # Landing page
│   └── api/                # API routes
├── components/             # React components
│   ├── ui/                 # Reusable UI components (Radix UI based)
│   └── [component-files]   # Application components
├── lib/                    # Utility functions and configurations
│   ├── supabase/           # Supabase client configuration
│   └── [utility-files]     # Actions, types, and utilities
├── hooks/                  # Custom React hooks
└── public/                 # Static assets
```

## 🔧 Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run tests
npm run test

# Run linting
npm run lint
```

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd meal-app-react
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these values from your [Supabase Dashboard](https://supabase.com/dashboard):

- Go to **Settings** → **API**
- Copy the **Project URL** and **anon public** key

### 4. Supabase Setup

Set up your Supabase project with the required tables and authentication settings.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
meal-app-react/
├── app/                     # Next.js App Router
│   ├── auth/               # Authentication pages
│   ├── dashboard/          # Dashboard and meal tracking
│   ├── food-details/       # Food detail pages
│   ├── landing/            # Landing page
│   └── api/                # API routes
├── components/             # React components
│   ├── ui/                 # Reusable UI components (Radix UI based)
│   └── [component-files]   # Application components
├── lib/                    # Utility functions and configurations
│   ├── supabase/           # Supabase client configuration
│   └── [utility-files]     # Actions, types, and utilities
├── hooks/                  # Custom React hooks
└── public/                 # Static assets
```

## 🔧 Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run tests
npm run test

# Run linting
npm run lint
```

## Build Notes

All of these warnings are expected during the build process and the application will deploy and function correctly despite them.

## 🧪 Testing Strategy

This project implements a comprehensive testing approach:

### Unit & Business Logic Tests (Jest)

- **Focus**: Core business logic and utility functions
- **Location**: `__tests__/lib/`
- **Coverage**: Nutrition calculations, data transformations, validation

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

**Key test files:**
- `nutrition-calculator.test.js` - Nutrition calculation logic
- `utils.test.js` - Utility function validation
- `usda-integration.test.js` - USDA data conversion
- `meal-calculations.test.js` - Meal tracking business logic

### End-to-End Tests (Cypress)

- **Focus**: Critical user flows and integration testing
- **Location**: `cypress/e2e/`
- **Coverage**: Authentication, food search, meal tracking, responsive design

```bash
# Open Cypress UI
npm run cypress

# Run headless
npm run cypress:headless

# Full E2E test with server
npm run test:e2e
```

**Test suites:**
- `auth-flow.cy.ts` - Login, signup, navigation
- `food-search.cy.ts` - Basic food search functionality
- `food-search-integration.cy.ts` - Search integration & guest mode
- `dashboard-meal-tracking.cy.ts` - Dashboard and meal tracking
- `responsive-design.cy.ts` - Mobile/tablet/desktop compatibility
- `error-handling.cy.ts` - Error states and edge cases

### Testing Philosophy

- **No UI unit tests**: We avoid testing React component rendering details
- **Business logic focus**: Unit tests concentrate on pure functions and calculations
- **Integration coverage**: Cypress tests handle user workflows
- **Performance testing**: Large datasets and responsive design validation
