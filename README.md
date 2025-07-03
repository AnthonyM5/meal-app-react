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
- **Styling**: Tailwind CSS with shadcn/ui components
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
│   ├── ui/                 # shadcn/ui components
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

### Advanced React Patterns
```typescript
// Custom Hook for Real-time Data Subscription
const useNutritionData = (userId: string) => {
  const [data, setData] = useState<NutritionData>()

  useEffect(() => {
    const subscription = supabase
      .from(`nutrition_${userId}`)
      .on('*', payload => {
        // Real-time update handling
      })
      .subscribe()

    return () => subscription.unsubscribe()
  }, [userId])
}

// Performance-optimized React Component
const NutritionChart = memo(({ data }: Props) => {
  const chartRef = useRef<HTMLCanvasElement>()

  // Memoized chart computation
  const chartData = useMemo(() => computeChartData(data), [data])

  return <Chart ref={chartRef} data={chartData} />
})
````

### Type-safe Database Queries

```typescript
// Strongly-typed Supabase query with joins
const getMealWithNutrition = async (mealId: string) => {
  const { data, error } = await supabase
    .from('meals')
    .select(
      `
      id,
      name,
      items:meal_items (
        id,
        food:foods (
          id,
          name,
          nutrition
        )
      )
    `
    )
    .eq('id', mealId)
    .single()

  return { data, error }
}
```

### API Route Implementation

```typescript
// Next.js API Route with Error Handling
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    const foods = await searchFoods(query)
    return NextResponse.json({ foods })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Failed to search foods' },
      { status: 500 }
    )
  }
}
```

## Development Setup

\`\`\`bash
npm install

# or

yarn install

# or

pnpm install
\`\`\`

### 3. Environment Setup

Create a `.env.local` file in the root directory:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

Get these values from your [Supabase Dashboard](https://supabase.com/dashboard):

- Go to **Settings** → **API**
- Copy the **Project URL** and **anon public** key

### 4. Supabase Setup

#### Option A: Using Supabase CLI (Recommended)

\`\`\`bash

# Install Supabase CLI (macOS)

brew install supabase/tap/supabase

# Login to Supabase

npx supabase login

# Link to your project

npx supabase link --project-ref your_project_ref

# Pull remote schema

npx supabase db pull
\`\`\`

#### Option B: Manual Setup

If CLI linking fails, manually set up your environment variables as shown in step 3.

### 5. Run the Development Server

\`\`\`bash
npm run dev

# or

yarn dev

# or

pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

\`\`\`
meal-app-react/
├── app/ # Next.js App Router
│ ├── auth/ # Authentication pages
│ ├── globals.css # Global styles
│ ├── layout.tsx # Root layout
│ └── page.tsx # Home page
├── components/ # React components
│ ├── ui/ # shadcn/ui components
│ ├── login-form.tsx # Login form component
│ └── signup-form.tsx # Signup form component
├── lib/ # Utility functions
│ ├── actions.ts # Server actions
│ ├── supabase/ # Supabase configuration
│ └── utils.ts # Utility functions
├── hooks/ # Custom React hooks
├── .vscode/ # VS Code settings
└── public/ # Static assets
\`\`\`

## 🔧 Development

### Available Scripts

\`\`\`bash

# Development server

npm run dev

# Build for production

npm run build

# Start production server

npm run start

# Lint code

npm run lint
\`\`\`

### VS Code Setup

This project includes optimized VS Code settings:

- **Auto-formatting** with Prettier
- **TypeScript** enhanced support
- **Tailwind CSS** IntelliSense
- **Supabase** extension integration
- **Debugging** configurations

Install recommended extensions when prompted by VS Code.

## 🗄️ Database Schema

The app uses the following main tables:

- **Users**: User profiles and preferences
- **Foods**: Food items and nutritional data
- **Meals**: User meal entries
- **Meal_Items**: Individual food items in meals

_Database migrations and schema will be added as the project develops._

## 🔐 Authentication

The app uses Supabase Auth with:

- **Email/Password** authentication
- **Server-side** session management
- **Protected routes** with middleware
- **Automatic redirects** for authenticated/unauthenticated users

## 🎨 UI Components

Built with [shadcn/ui](https://ui.shadcn.com/) components for a modern, accessible interface:

- **Forms**: Login, signup, and data entry forms
- **Navigation**: Responsive navigation and menus
- **Data Display**: Cards for food items and nutritional information
- **Feedback**: Toast notifications and loading states

## 🚀 Deployment

The app can be deployed to platforms that support Next.js:

- **Vercel** (recommended)
- **Netlify**
- **Railway**
- **DigitalOcean App Platform**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🐛 Troubleshooting

### Common Issues

**Supabase Connection Issues**
- Verify your environment variables are correct
- Check your Supabase project is active
- Ensure your database is accessible

**Build Errors**
- Clear `.next` folder and rebuild
- Check for TypeScript errors
- Verify all dependencies are installed

**Authentication Issues**
- Check Supabase Auth settings
- Verify redirect URLs in Supabase dashboard
- Clear browser cookies and try again

### Getting Help

- Check the [Issues](../../issues) page
- Review [Supabase Documentation](https://supabase.com/docs)
- Visit [Next.js Documentation](https://nextjs.org/docs)

---

**Happy coding! 🎉**

## Build Notes

When building the project, you may see the following expected warnings that do not affect functionality:

### Dynamic Route Warnings

```
Dynamic server usage: Route /auth/login couldn't be rendered statically because it used `cookies`
```

These warnings appear for routes that use cookies (auth, dashboard, etc). This is expected behavior as these routes need to be dynamic. The middleware handles this correctly and the routes are properly configured as server-side rendered.

### Supabase Realtime Warning

```
Critical dependency: the request of a dependency is an expression
./node_modules/@supabase/realtime-js/dist/main/RealtimeClient.js
```

This is a known warning from the Supabase Realtime client. It does not affect functionality and is related to how the client handles WebSocket connections.

### Metadata Warnings

```
Unsupported metadata themeColor is configured in metadata export. Please move it to viewport export instead.
```

These are style suggestions for Next.js metadata configuration. They don't affect functionality and can be addressed in future updates if needed.

All of these warnings are expected during the build process and the application will deploy and function correctly despite them.
