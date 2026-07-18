'use client'

import { DogForm } from '@/components/dog-form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { deleteDog, getUserDogs } from '@/lib/dog-actions'
import { dailyEnergyForDog, energyInputsFromDog } from '@/lib/canine-nutrition'
import type { Dog } from '@/lib/types'
import { Dog as DogIcon, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

function formatLabel(value: string) {
  return value.replace(/_/g, ' ')
}

export default function DogsPage() {
  const router = useRouter()
  const [dogs, setDogs] = useState<Dog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Determined client-side in an effect to avoid a hydration mismatch
  const [isGuest, setIsGuest] = useState(false)

  const loadDogs = useCallback(async () => {
    try {
      const userDogs = await getUserDogs()
      setDogs(userDogs)
    } catch (error) {
      console.error('Error loading dogs:', error)
      toast.error('Failed to load dogs')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const guest = document.cookie.includes('guestMode=true')
    setIsGuest(guest)
    if (guest) {
      setIsLoading(false)
      return
    }
    loadDogs()
  }, [loadDogs])

  const handleDelete = async (dog: Dog) => {
    setDeletingId(dog.id)
    try {
      await deleteDog(dog.id)
      toast.success(`Removed ${dog.name}`)
      await loadDogs()
    } catch (error) {
      console.error('Delete dog error:', error)
      toast.error('Failed to delete dog')
    } finally {
      setDeletingId(null)
    }
  }

  if (isGuest) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 p-4 pb-8">
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-yellow-500">
                Sign in to add your dogs and track their nutrition.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/auth/login')}
              >
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Dogs</h1>
          <p className="text-sm text-muted-foreground">
            Feeding targets are calculated from each dog&apos;s profile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <DogForm
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add dog
              </Button>
            }
            onSaved={loadDogs}
          />
        </div>
      </div>

      {dogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <DogIcon className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-semibold">No dogs yet</p>
              <p className="text-sm text-muted-foreground">
                Add your first dog to start tracking their nutrition.
              </p>
            </div>
            <DogForm
              trigger={
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add your first dog
                </Button>
              }
              onSaved={loadDogs}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dogs.map(dog => (
            <Card key={dog.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{dog.name}</CardTitle>
                    <CardDescription>
                      {dog.breed || 'Mixed breed'} · {dog.weight_kg} kg
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <DogForm
                      key={`${dog.id}-${dog.updated_at}`}
                      dog={dog}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Edit ${dog.name}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                      onSaved={loadDogs}
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${dog.name}`}
                          disabled={deletingId === dog.id}
                        >
                          {deletingId === dog.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Remove {dog.name}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This deletes {dog.name}&apos;s profile and all
                            logged meals. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(dog)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary">{formatLabel(dog.life_stage)}</Badge>
                  <Badge variant="secondary">
                    {formatLabel(dog.activity_level)}
                  </Badge>
                  {dog.neutered && <Badge variant="outline">neutered</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  ~{Math.round(dailyEnergyForDog(energyInputsFromDog(dog)))}{' '}
                  kcal/day
                </p>
                {dog.health_conditions.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Health: {dog.health_conditions.join(', ')} — consult your
                    vet before diet changes.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
