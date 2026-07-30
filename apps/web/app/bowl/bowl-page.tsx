'use client'

import {
  BowlConfirmation,
  type AnalyzedBowlItem,
  type ScaleBasis,
} from '@/components/bowl-confirmation'
import { GuestBowlResult } from '@/components/guest-bowl-result'
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
import { Textarea } from '@/components/ui/textarea'
import { useGuestMode } from '@/hooks/use-guest-mode'
import { getUserDogs } from '@/lib/dog-actions'
import type { Dog } from '@/lib/types'
import { Camera, Dog as DogIcon, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_BYTES = 10 * 1024 * 1024 // matches the bowl-photos bucket limit

interface AnalysisResponse {
  /** Absent for guests — they get no persisted analysis to correct. */
  analysis_id?: string
  /** Absent for guests — their photo is never uploaded. */
  image_url?: string
  guest?: boolean
  items: AnalyzedBowlItem[]
  notes: string
  /** What the gram estimates were scaled against; null = no estimates */
  scale_basis?: ScaleBasis | null
}

/** Client-side upload guard. The route re-checks; this just fails faster. */
function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Use a JPEG, PNG, WebP, or GIF photo'
  }
  if (file.size > MAX_BYTES) return 'That photo is larger than 10 MB'
  return null
}

/**
 * Selects a photo — it does NOT start the analysis.
 *
 * Analysis used to fire the instant a file was chosen, which gave the owner no
 * chance to describe what the photo can't show (mixed-in, shredded, or
 * broth-covered foods) before the model ran. They could only correct it
 * afterwards via re-analysis, which discards any grams already entered. Now
 * choosing a photo just stages it, and a separate action runs the model.
 */
function PhotoPicker({
  hasFile,
  disabled,
  onFile,
}: {
  hasFile: boolean
  disabled?: boolean
  onFile: (file: File) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        // No `capture` attr: lets mobile show the native chooser (take a
        // photo OR pick from the library); a normal file picker on desktop
        className="hidden"
        data-testid="bowl-photo-input"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          // Allow re-selecting the same file after a failure
          e.target.value = ''
        }}
      />
      <Button
        className="w-full"
        variant={hasFile ? 'outline' : 'default'}
        disabled={disabled}
        onClick={() => fileInputRef.current?.click()}
      >
        <Camera className="mr-2 h-4 w-4" />
        {hasFile ? 'Choose a different photo' : 'Take or choose a photo'}
      </Button>
    </>
  )
}

/** Staged photo preview, shown between choosing and analyzing. */
function PhotoPreview({ url }: { url: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- local object URL
    <img
      src={url}
      alt="Selected bowl"
      className="max-h-56 w-full rounded-md border object-contain"
    />
  )
}

/** Runs the model on the staged photo. */
function AnalyzeButton({
  isAnalyzing,
  disabled,
  onClick,
}: {
  isAnalyzing: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      className="w-full"
      disabled={isAnalyzing || disabled}
      onClick={onClick}
      data-testid="bowl-analyze-button"
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Analyzing bowl…
        </>
      ) : (
        <>
          <Sparkles className="mr-2 h-4 w-4" />
          Analyze this photo
        </>
      )}
    </Button>
  )
}

const MODEL_DISCLAIMER = (
  <p className="text-xs text-muted-foreground">
    The model identifies ingredients and rough proportions only — never grams,
    and never nutrient math.
  </p>
)

/**
 * Guest scan: no dog, no upload, no persistence.
 *
 * The preview image is a local object URL, because the guest branch of
 * /api/bowl/analyze never stores the photo and so returns no image_url.
 */
function GuestBowlView() {
  const { exitGuestMode } = useGuestMode()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Staged but not yet analyzed — the owner triggers the model explicitly.
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  // Object URLs leak until revoked; drop the old one whenever it's replaced
  // and on unmount.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const reset = useCallback(() => {
    setAnalysis(null)
    setPreviewUrl(null)
    setPendingFile(null)
  }, [])

  const handleFile = useCallback((file: File) => {
    const invalid = validateFile(file)
    if (invalid) {
      toast.error(invalid)
      return
    }
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!pendingFile) return
    setIsAnalyzing(true)
    try {
      const body = new FormData()
      body.append('image', pendingFile)

      const response = await fetch('/api/bowl/analyze', {
        method: 'POST',
        body,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Bowl analysis failed')

      setAnalysis(data as AnalysisResponse)
    } catch (error) {
      console.error('Bowl analysis error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Bowl analysis failed'
      )
    } finally {
      setIsAnalyzing(false)
    }
  }, [pendingFile])

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-4 pb-8">
      <div>
        <h1 className="text-2xl font-bold">Scan a bowl</h1>
        <p className="text-sm text-muted-foreground">
          Photograph your dog&apos;s bowl and we&apos;ll identify what&apos;s in
          it.
        </p>
      </div>

      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-yellow-600 dark:text-yellow-500">
            You&apos;re in guest mode. Scans identify ingredients and flag unsafe
            ones — sign in for the nutrient gap analysis.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={exitGuestMode}
          >
            Sign In
          </Button>
        </CardContent>
      </Card>

      {analysis ? (
        <GuestBowlResult
          items={analysis.items}
          notes={analysis.notes}
          previewUrl={previewUrl}
          onScanAnother={reset}
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
            {previewUrl && <PhotoPreview url={previewUrl} />}
            <PhotoPicker hasFile={!!pendingFile} onFile={handleFile} />
            {pendingFile && (
              <AnalyzeButton isAnalyzing={isAnalyzing} onClick={handleAnalyze} />
            )}
            {MODEL_DISCLAIMER}
            <p className="text-xs text-muted-foreground">
              Guest photos are analyzed and discarded — nothing is uploaded or
              stored.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Authenticated scan: pick a dog, confirm grams, log the meal. */
function OwnerBowlView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [dogs, setDogs] = useState<Dog[]>([])
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null)
  const [isLoadingDogs, setIsLoadingDogs] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null)
  // Staged but not yet analyzed. Choosing a photo no longer starts the model —
  // the owner gets to write the hint below with the photo in front of them,
  // then trigger analysis explicitly.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  // Optional owner note guiding identification (mixed-in/submerged items the
  // photo can't show). Passed to the model; never a source of grams.
  const [hint, setHint] = useState('')

  // Object URLs leak until revoked; drop the old one when replaced/unmounted.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])
  // Bumped on re-analysis so BowlConfirmation remounts with the fresh items
  // (its rows state is seeded once from props).
  const [revision, setRevision] = useState(0)

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

  const handleFile = useCallback((file: File) => {
    const invalid = validateFile(file)
    if (invalid) {
      toast.error(invalid)
      return
    }
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (!pendingFile) return
    if (!selectedDogId) {
      toast.error('Select a dog first')
      return
    }

    setIsAnalyzing(true)
    try {
      const body = new FormData()
      body.append('image', pendingFile)
      body.append('dog_id', selectedDogId)
      if (hint.trim()) body.append('hint', hint.trim())

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
    }
  }, [pendingFile, selectedDogId, hint])

  // Re-run the model on the already-uploaded photo with a corrective note —
  // for misses the owner only spots on the confirmation screen.
  const handleReanalyze = useCallback(
    async (note: string) => {
      if (!analysis?.analysis_id) return
      const body = new FormData()
      body.append('analysis_id', analysis.analysis_id)
      body.append('hint', note)

      const response = await fetch('/api/bowl/analyze', {
        method: 'POST',
        body,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Re-analysis failed')
      }
      setAnalysis(data as AnalysisResponse)
      setRevision(r => r + 1)
    },
    [analysis?.analysis_id]
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

      {/* §2.2 capture guidance: encourage (never require) the conditions
          that make the deterministic portion estimator work — top-down
          angle, and a known-size object in frame for scale. */}
      {!analysis && (
        <Card className="border-dashed">
          <CardContent className="space-y-1.5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              Get portion estimates from your photo
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Shoot from directly above the bowl, in good light.</li>
              <li>
                Set your dog&apos;s bowl diameter once (edit the dog on the{' '}
                <Link href="/dogs" className="underline">
                  Dogs page
                </Link>
                ) — the bowl itself then works as the size reference in every
                photo.
              </li>
              <li>
                Or lay a credit card or a quarter flat next to the bowl,
                fully visible.
              </li>
            </ul>
            <p className="text-xs">
              Without a size reference we still identify the food — you just
              enter the grams yourself.
            </p>
          </CardContent>
        </Card>
      )}

      {analysis?.analysis_id && analysis.image_url && selectedDogId ? (
        <BowlConfirmation
          key={revision}
          dogId={selectedDogId}
          analysisId={analysis.analysis_id}
          imageUrl={analysis.image_url}
          items={analysis.items}
          notes={analysis.notes}
          scaleBasis={analysis.scale_basis ?? null}
          onLogged={() => router.push('/dashboard')}
          onReanalyze={handleReanalyze}
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

            {previewUrl && <PhotoPreview url={previewUrl} />}

            <PhotoPicker
              hasFile={!!pendingFile}
              disabled={!selectedDogId}
              onFile={handleFile}
            />

            {/* Hint sits between choosing and analyzing on purpose: the owner
                writes it with the photo visible, so they can see what the
                model will miss before it runs — rather than discovering it
                afterwards and paying for a re-analysis that resets grams. */}
            <div className="space-y-1">
              <label
                htmlFor="bowl-hint"
                className="text-sm text-muted-foreground"
              >
                Anything the photo might miss? (optional)
              </label>
              <Textarea
                id="bowl-hint"
                value={hint}
                onChange={e => setHint(e.target.value)}
                maxLength={500}
                rows={2}
                disabled={isAnalyzing}
                placeholder='e.g. "there&apos;s also ground beef and shredded chicken mixed in"'
              />
              <p className="text-xs text-muted-foreground">
                Mixed-in, shredded, or broth-covered foods are easy to miss —
                name them here and the analysis will include them.
              </p>
            </div>

            {pendingFile && (
              <AnalyzeButton
                isAnalyzing={isAnalyzing}
                disabled={!selectedDogId}
                onClick={handleAnalyze}
              />
            )}

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

function BowlPageContent() {
  const { isGuest } = useGuestMode()

  // useGuestMode resolves the cookie in an effect, so its first value is always
  // `false` — including for guests. Rendering on that would mount OwnerBowlView
  // and fire the dog-scoped server action before the flip. Wait one tick.
  const [cookieChecked, setCookieChecked] = useState(false)
  useEffect(() => setCookieChecked(true), [])

  if (!cookieChecked) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Mirrors the dashboard: the guest cookie wins over any session, so a guest
  // never lands in a view that calls dog-scoped server actions.
  return isGuest ? <GuestBowlView /> : <OwnerBowlView />
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
