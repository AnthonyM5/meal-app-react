import type { DogInput } from '@pawplate/api-client'
import type { DogActivityLevel, DogLifeStage } from '@pawplate/core'
import { Button } from '@pawplate/ui/button'
import { Input } from '@pawplate/ui/input'
import { Label } from '@pawplate/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@pawplate/ui/select'
import { Switch } from '@pawplate/ui/switch'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { api } from '../lib/api'

const LIFE_STAGES: Array<{ value: DogLifeStage; label: string }> = [
  { value: 'puppy', label: 'Puppy' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior' },
  { value: 'pregnant', label: 'Pregnant' },
  { value: 'lactating', label: 'Lactating' },
]

const ACTIVITY_LEVELS: Array<{ value: DogActivityLevel; label: string }> = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'lightly_active', label: 'Lightly active' },
  { value: 'moderately_active', label: 'Moderately active' },
  { value: 'very_active', label: 'Very active' },
  { value: 'working', label: 'Working' },
]

export function DogFormScreen() {
  const { dogId } = useParams()
  const isEdit = Boolean(dogId)
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [breed, setBreed] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [idealWeightKg, setIdealWeightKg] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [lifeStage, setLifeStage] = useState<DogLifeStage>('adult')
  const [activityLevel, setActivityLevel] =
    useState<DogActivityLevel>('moderately_active')
  const [neutered, setNeutered] = useState(false)
  const [bowlDiameterCm, setBowlDiameterCm] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!dogId) return
    let cancelled = false
    api.dogs
      .get(dogId)
      .then(dog => {
        if (cancelled) return
        setName(dog.name)
        setBreed(dog.breed ?? '')
        setWeightKg(String(dog.weight_kg))
        setIdealWeightKg(dog.ideal_weight_kg ? String(dog.ideal_weight_kg) : '')
        setBirthDate(dog.birth_date ?? '')
        setLifeStage(dog.life_stage)
        setActivityLevel(dog.activity_level)
        setNeutered(dog.neutered)
        setBowlDiameterCm(
          dog.bowl_diameter_cm ? String(dog.bowl_diameter_cm) : ''
        )
        setLoading(false)
      })
      .catch((error: Error) => {
        if (!cancelled) {
          toast.error(error.message)
          navigate('/dogs', { replace: true })
        }
      })
    return () => {
      cancelled = true
    }
  }, [dogId, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input: DogInput = {
      name: name.trim(),
      breed: breed.trim() || null,
      weight_kg: Number(weightKg),
      ideal_weight_kg: idealWeightKg ? Number(idealWeightKg) : null,
      birth_date: birthDate || null,
      life_stage: lifeStage,
      activity_level: activityLevel,
      neutered,
      bowl_diameter_cm: bowlDiameterCm ? Number(bowlDiameterCm) : null,
    }

    setSubmitting(true)
    try {
      if (dogId) {
        await api.dogs.update(dogId, input)
        toast.success(`${input.name} updated`)
        navigate(`/dogs/${dogId}`)
      } else {
        const dog = await api.dogs.create(input)
        toast.success(`${dog.name} added`)
        navigate(`/dogs/${dog.id}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!dogId) return
    if (!window.confirm(`Delete ${name}? This removes all their meals too.`)) {
      return
    }
    try {
      await api.dogs.remove(dogId)
      toast.success(`${name} deleted`)
      navigate('/dogs', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild aria-label="Back">
          <Link to={dogId ? `/dogs/${dogId}` : '/dogs'}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">
          {isEdit ? `Edit ${name || 'dog'}` : 'Add a dog'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="breed">Breed</Label>
          <Input
            id="breed"
            value={breed}
            onChange={e => setBreed(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <Input
              id="weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              required
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ideal-weight">Ideal weight (kg)</Label>
            <Input
              id="ideal-weight"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              value={idealWeightKg}
              onChange={e => setIdealWeightKg(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="birth-date">Birth date</Label>
          <Input
            id="birth-date"
            type="date"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Life stage</Label>
          <Select
            value={lifeStage}
            onValueChange={value => setLifeStage(value as DogLifeStage)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIFE_STAGES.map(stage => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Activity level</Label>
          <Select
            value={activityLevel}
            onValueChange={value =>
              setActivityLevel(value as DogActivityLevel)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_LEVELS.map(level => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <Label htmlFor="neutered">Neutered / spayed</Label>
          <Switch
            id="neutered"
            checked={neutered}
            onCheckedChange={setNeutered}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bowl-diameter">Bowl inner diameter (cm)</Label>
          <Input
            id="bowl-diameter"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="1"
            value={bowlDiameterCm}
            onChange={e => setBowlDiameterCm(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Optional — used to scale bowl-photo portion estimates.
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Add dog'}
        </Button>
      </form>

      {isEdit && (
        <Button
          variant="outline"
          className="w-full text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete dog
        </Button>
      )}
    </div>
  )
}
