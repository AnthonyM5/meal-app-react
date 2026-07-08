'use client'

import {
  BowlConfirmation,
  type AnalyzedBowlItem,
} from '@/components/bowl-confirmation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUserDogs } from '@/lib/dog-actions'
import type { Dog } from '@/lib/types'
import { Camera, Dog as DogIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // matches the bowl-photos bucket limit

interface AnalysisResponse {
  analysis_id: string
  image_url: string
  items: AnalyzedBowlItem[]
  notes: string
}

function BowlPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [dogs, setDogs] = useState<Dog[]>([])
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null)
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getUserDogs()
      .then(userDogs => {
        setDogs(userDogs)
        const requested = searchParams.get('dog')
        setSelectedDogId(
          requested && userDogs.some(d => d.id === requested)
            ? requested
            : userDogs[0]?.id ?? null
        )
      })
      .catch(error => {
        console.error('Error loading dogs:', error)
        toast.error('Failed to load your dogs')
      })
      .finally(() => setIsLoadingDogs(false))
  }, [searchParams])

  const handleFile = useCallback(
    async (file: File) => {
      if (!selectedDogId) {
        toast.error('Select a dog first')
        return
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error('Use a JPEG, PNG, WebP, or GIF photo')
        return
      }
      if (file.size > MAX_BYTES) {
        toast.error('That photo is larger than 10 MB')
        return
      }

      setIsAnalyzing(true)
      try {
        const body = new FormData()
        body.append('image', file)
        body.append('dog_id', selectedDogId)

        const response = await fetch('/api/bowl/analyze', {
          method: 'POST',
          body,
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Bowl analysis failed')
        }
        setAnalysis(data as AnalysisResponse)
      } catch (error) {
        console.error('Bowl analysis error:', error)
        toast.error(
          error instanceof Error ? error.message : 'Bowl analysis failed'
        )
      } finally {
        setIsAnalyzing(false)
        // Allow re-selecting the same file after a failure
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [selectedDogId]
  )

  if (isLoadingDogs) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (dogs.length === 0) {
    return (
      <div className="container mx-auto max-w-2xl p-4 pb-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <DogIcon className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-semibold">No dogs yet</p>
              <p className="text-sm text-muted-foreground">
                Add a dog before logging a meal from a photo.
              </p>
            </div>
            <Button asChild>
              <Link href="/dogs">Add a dog</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Log from a photo</h1>
          <p className="text-sm text-muted-foreground">
            Snap your dog&apos;s bowl and we&apos;ll identify the ingredients.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </div>

      {analysis && selectedDogId ? (
        <BowlConfirmation
          dogId={selectedDogId}
          analysisId={analysis.analysis_id}
          imageUrl={analysis.image_url}
          items={analysis.items}
          notes={analysis.notes}
          onLogged={() => router.push('/dashboard')}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Take or choose a photo</CardTitle>
            <CardDescription>
              One bowl per photo, shot from above, in good light.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Dog</label>
              <Select
                value={selectedDogId ?? undefined}
                onValueChange={setSelectedDogId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a dog" />
                </SelectTrigger>
                <SelectContent>
                  {dogs.map(dog => (
                    <SelectItem key={dog.id} value={dog.id}>
                      {dog.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(',')}
              // Opens the rear camera on mobile; a normal file picker elsewhere
              capture="environment"
              className="hidden"
              data-testid="bowl-photo-input"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />

            <Button
              className="w-full"
              disabled={isAnalyzing || !selectedDogId}
              onClick={() => fileInputRef.current?.click()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing bowl…
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Take or choose a photo
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              The model identifies ingredients and rough proportions only — you
              confirm the ingredients and enter the actual grams on the next
              step. Nutrient math is never done by the model.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function BowlPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <BowlPageContent />
    </Suspense>
  )
}
