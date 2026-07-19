import type { Dog } from '@pawplate/core'
import { Button } from '@pawplate/ui/button'
import { Card, CardContent } from '@pawplate/ui/card'
import { ChevronRight, Loader2, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'

export function DogsScreen() {
  const [dogs, setDogs] = useState<Dog[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api.dogs
      .list()
      .then(result => {
        if (!cancelled) setDogs(result)
      })
      .catch((error: Error) => {
        if (!cancelled) {
          toast.error(error.message)
          setDogs([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (dogs === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your dogs</h1>
        <Button asChild size="sm">
          <Link to="/dogs/new">
            <Plus className="mr-1 h-4 w-4" /> Add dog
          </Link>
        </Button>
      </div>

      {dogs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No dogs yet — add your first dog to start tracking meals.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dogs.map(dog => (
            <Link key={dog.id} to={`/dogs/${dog.id}`} className="block">
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{dog.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {dog.breed ? `${dog.breed} · ` : ''}
                      {dog.weight_kg} kg · {dog.life_stage.replace('_', ' ')}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
