# UI Component Documentation

## Core Components

### Layout Components

#### AppLayout

```typescript
// components/layout/AppLayout.tsx
interface AppLayoutProps {
  children: React.ReactNode
}
```

Main application layout wrapper that includes the navigation bar, sidebar, and main content area.

#### NavigationBar

```typescript
// components/layout/NavigationBar.tsx
interface NavigationBarProps {
  user?: User
  isGuest?: boolean
}
```

Top navigation bar with user menu, search, and main navigation items.

### Authentication Components

#### LoginForm

```typescript
// components/auth/LoginForm.tsx
interface LoginFormProps {
  onSuccess?: () => void
  onError?: (error: Error) => void
}
```

Email and password login form with validation.

#### GuestModeButton

```typescript
// components/auth/GuestModeButton.tsx
interface GuestModeButtonProps {
  onGuestLogin: () => void
}
```

Button to enable guest mode access.

### Food Tracking Components

#### FoodSearch

```typescript
// components/food/FoodSearch.tsx
interface FoodSearchProps {
  onSelect: (food: FoodItem) => void
  placeholder?: string
}
```

Searchable combobox for finding foods in the USDA database.

#### FoodCard

```typescript
// components/food/FoodCard.tsx
interface FoodCardProps {
  food: FoodItem
  onSave?: () => void
  onLog?: () => void
}
```

Card displaying food information with action buttons.

#### NutritionLabel

```typescript
// components/food/NutritionLabel.tsx
interface NutritionLabelProps {
  nutrients: Nutrient[]
  servingSize: number
}
```

FDA-style nutrition facts label component.

### Form Components

#### ServingSizeInput

```typescript
// components/form/ServingSizeInput.tsx
interface ServingSizeInputProps {
  value: number
  onChange: (value: number) => void
  units: string[]
}
```

Input for selecting serving size with unit conversion.

#### MealTypeSelect

```typescript
// components/form/MealTypeSelect.tsx
interface MealTypeSelectProps {
  value: string
  onChange: (value: string) => void
}
```

Dropdown for selecting meal type (breakfast, lunch, dinner, snack).

### Dashboard Components

#### DailyProgress

```typescript
// components/dashboard/DailyProgress.tsx
interface DailyProgressProps {
  calories: number
  target: number
}
```

Progress indicators for daily nutrition goals.

#### MealList

```typescript
// components/dashboard/MealList.tsx
interface MealListProps {
  meals: Meal[]
  onDelete?: (id: string) => void
}
```

List of meals logged for the current day.

## Usage Examples

### Basic Layout

```tsx
<AppLayout>
  <NavigationBar user={currentUser} />
  <main>
    <DailyProgress calories={totalCalories} target={targetCalories} />
    <MealList meals={todaysMeals} />
  </main>
</AppLayout>
```

### Food Search and Logging

```tsx
<FoodSearch
  onSelect={async food => {
    const foodCard = (
      <FoodCard
        food={food}
        onLog={() => handleLogFood(food)}
        onSave={() => handleSaveFood(food)}
      />
    )
    await showModal(foodCard)
  }}
/>
```

### Nutrition Display

```tsx
<NutritionLabel nutrients={selectedFood.nutrients} servingSize={servingSize} />
```

## Component Best Practices

1. **State Management**

   - Use React Query for server state
   - Use local state for UI interactions
   - Implement proper loading states

2. **Error Handling**

   - Show error messages inline
   - Provide fallback UI
   - Log errors appropriately

3. **Accessibility**

   - Include ARIA labels
   - Support keyboard navigation
   - Follow WCAG guidelines

4. **Performance**
   - Implement proper memoization
   - Lazy load components
   - Optimize re-renders

## Theming

### Colors

```typescript
// styles/theme.ts
export const colors = {
  primary: '#4F46E5',
  secondary: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  // ... more colors
}
```

### Typography

```typescript
export const typography = {
  fontFamily: {
    sans: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    // ... more sizes
  },
}
```

## Animation Guidelines

### Transitions

```typescript
export const transitions = {
  default: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  fast: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
}
```

### Examples

```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.2 }}
>
  {/* Component content */}
</motion.div>
```

## Testing

### Component Testing

```typescript
// components/__tests__/FoodCard.test.tsx
describe('FoodCard', () => {
  it('renders food information correctly', () => {
    const food = mockFoodItem()
    render(<FoodCard food={food} />)

    expect(screen.getByText(food.description)).toBeInTheDocument()
    // ... more assertions
  })
})
```

### Integration Testing

```typescript
describe('Food logging flow', () => {
  it('allows users to search and log food', async () => {
    render(<FoodSearch onSelect={mockOnSelect} />)

    await userEvent.type(screen.getByRole('searchbox'), 'apple')
    await waitFor(() => {
      expect(screen.getByText('Apple, raw')).toBeInTheDocument()
    })
    // ... more test steps
  })
})
```
