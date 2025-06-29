# Local Development Setup Guide

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- Supabase CLI (optional, for local development)

## Initial Setup

1. **Clone the Repository**

```bash
git clone <repository-url>
cd meal-app-react
```

2. **Environment Variables**
   Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `USDA_API_KEY`: Your USDA Food Database API key

3. **Install Dependencies**

```bash
npm install
# or
yarn install
```

4. **Database Setup**

- Set up a new Supabase project
- Run the database migrations:

```bash
npm run db:migrate
# or
yarn db:migrate
```

## Development Server

1. **Start the Development Server**

```bash
npm run dev
# or
yarn dev
```

2. **Access the Application**
   Open [http://localhost:3000](http://localhost:3000) in your browser

## Testing

1. **Run Unit Tests**

```bash
npm run test
# or
yarn test
```

2. **Run E2E Tests**

```bash
npm run test:e2e
# or
yarn test:e2e
```

## Build for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**

- Verify environment variables
- Check Supabase console for connection status
- Ensure proper permissions are set

2. **API Rate Limiting**

- Check USDA API quotas
- Implement local caching if needed

3. **Build Errors**

- Clear `.next` directory
- Delete `node_modules` and reinstall
- Check TypeScript errors
