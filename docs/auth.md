# Authentication Guide

## Overview

NutriTrack implements a flexible authentication system using Supabase Auth, supporting both traditional user accounts and a guest mode. This guide explains the implementation details and usage.

## Authentication Methods

### 1. Traditional User Authentication

Users can create an account and sign in using:

- Email/Password authentication
- (Future: OAuth providers like Google, GitHub)

#### Implementation

```typescript
// Login form component
export function LoginForm() {
  const handleSubmit = async (data: LoginFormData) => {
    const { email, password } = data
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    // Handle response...
  }
}

// Sign-up form component
export function SignUpForm() {
  const handleSubmit = async (data: SignUpFormData) => {
    const { email, password } = data
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })
    // Handle response...
  }
}
```

### 2. Guest Mode

Allows users to try the application without creating an account.

#### Implementation

```typescript
// Guest mode hook
export function useGuestMode() {
  const [isGuest, setIsGuest] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const guestMode = sessionStorage.getItem('guestMode') === 'true'
    setIsGuest(guestMode)
  }, [])

  const exitGuestMode = () => {
    sessionStorage.removeItem('guestMode')
    setIsGuest(false)
    router.push('/auth/login')
  }

  return { isGuest, exitGuestMode }
}

// Guest mode button component
export function GuestModeButton() {
  const router = useRouter()

  const handleGuestMode = () => {
    sessionStorage.setItem('guestMode', 'true')
    router.push('/dashboard')
  }

  return <Button onClick={handleGuestMode}>Continue as Guest</Button>
}
```

## Protected Routes

### Middleware Implementation

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createMiddlewareClient({ req: request, res: response })
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const isGuestMode = request.cookies.get('guestMode')?.value === 'true'

  // Allow public routes
  if (PUBLIC_ROUTES.includes(path)) {
    return response
  }

  // Check guest mode access
  const isGuestAllowedRoute = GUEST_ALLOWED_ROUTES.some(route =>
    path.startsWith(route)
  )

  if (session || (isGuestMode && isGuestAllowedRoute)) {
    return response
  }

  // Redirect to login
  return NextResponse.redirect(new URL('/auth/login', request.url))
}
```

## Feature Access Control

### Guest Mode Restrictions

```typescript
// Example of conditional rendering based on auth state
function DashboardPage() {
  const { isGuest } = useGuestMode()

  return (
    <div>
      {isGuest ? <GuestBanner /> : <MealTracker />}
      <SearchSection /> {/* Available to all users */}
    </div>
  )
}

// Example of action protection
function useFoodActions() {
  const { isGuest } = useGuestMode()
  const { toast } = useToast()

  const handleGuestError = () => {
    toast({
      title: 'Action not available in guest mode',
      description: 'Please sign in to use this feature',
      variant: 'destructive',
    })
  }

  return {
    addFoodToMeal: async (...args) => {
      if (isGuest) {
        handleGuestError()
        return null
      }
      return actions.addFoodToMeal(...args)
    },
    // Other actions...
  }
}
```

## Database Security

### Row Level Security (RLS)

```sql
-- Example RLS policies
alter table public.meals enable row level security;

-- Allow users to read their own meals
create policy "Users can view their own meals"
  on meals for select
  using (auth.uid() = user_id);

-- Allow users to insert their own meals
create policy "Users can create their own meals"
  on meals for insert
  with check (auth.uid() = user_id);

-- Allow public access to foods table
create policy "Anyone can view foods"
  on foods for select
  using (true);
```

## Session Management

### Traditional Auth

- Supabase handles session management
- Automatic token refresh
- Persistent sessions with local storage

### Guest Mode

- Session storage based
- Cleared on browser close
- No persistent data

## Error Handling

```typescript
async function handleAuth(action: () => Promise<void>) {
  try {
    await action()
  } catch (error) {
    if (isAuthError(error)) {
      toast({
        title: 'Authentication Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    }
  }
}
```

## Best Practices

1. **Security**

   - Use HTTPS
   - Implement CSRF protection
   - Sanitize user input
   - Use secure session cookies

2. **UX Considerations**

   - Clear error messages
   - Loading states
   - Redirect handling
   - Remember user preferences

3. **Performance**

   - Minimize re-renders
   - Efficient state management
   - Proper error boundaries

4. **Testing**
   - Test auth flows
   - Test guest mode
   - Test error cases
   - Test security policies
