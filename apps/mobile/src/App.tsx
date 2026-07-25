import { Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { RequireAuth } from './auth/RequireAuth'
import { AppShell } from './components/AppShell'
import { BowlPhotoScreen } from './screens/BowlPhotoScreen'
import { DogDetailScreen } from './screens/DogDetailScreen'
import { DogFormScreen } from './screens/DogFormScreen'
import { DogsScreen } from './screens/DogsScreen'
import { FoodDetailsScreen } from './screens/FoodDetailsScreen'
import { FoodsScreen } from './screens/FoodsScreen'
import { LoginScreen } from './screens/LoginScreen'
import { MealFormScreen } from './screens/MealFormScreen'
import { SignupScreen } from './screens/SignupScreen'

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/dogs" replace />} />
            <Route path="/dogs" element={<DogsScreen />} />
            <Route path="/dogs/new" element={<DogFormScreen />} />
            <Route path="/dogs/:dogId" element={<DogDetailScreen />} />
            <Route path="/dogs/:dogId/edit" element={<DogFormScreen />} />
            <Route
              path="/dogs/:dogId/meals/new"
              element={<MealFormScreen />}
            />
            <Route path="/dogs/:dogId/bowl" element={<BowlPhotoScreen />} />
            <Route path="/foods" element={<FoodsScreen />} />
            <Route path="/foods/:foodId" element={<FoodDetailsScreen />} />
            <Route path="/meals/:mealId/edit" element={<MealFormScreen />} />
            <Route path="*" element={<Navigate to="/dogs" replace />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  )
}
