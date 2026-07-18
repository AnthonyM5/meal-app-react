'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createDog, updateDog, type DogInput } from '@/lib/dog-actions'
import type { Dog, DogActivityLevel, DogLifeStage } from '@/lib/types'
import { Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

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

interface DogFormProps {
  /** When set, the form edits this dog; otherwise it creates a new one */
  dog?: Dog
  trigger: ReactNode
  onSaved?: (dog: Dog) => void
}

export function DogForm({ dog, trigger, onSaved }: DogFormProps) {
  const [open, setOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [name, setName] = useState(dog?.name ?? '')
  const [breed, setBreed] = useState(dog?.breed ?? '')
  const [weightKg, setWeightKg] = useState(dog ? String(dog.weight_kg) : '')
  const [idealWeightKg, setIdealWeightKg] = useState(
    dog?.ideal_weight_kg != null ? String(dog.ideal_weight_kg) : ''
  )
  const [birthDate, setBirthDate] = useState(dog?.birth_date ?? '')
  const [lifeStage, setLifeStage] = useState<DogLifeStage>(
    dog?.life_stage ?? 'adult'
  )
  const [activityLevel, setActivityLevel] = useState<DogActivityLevel>(
    dog?.activity_level ?? 'moderately_active'
  )
  const [neutered, setNeutered] = useState(dog?.neutered ?? true)
  const [healthConditions, setHealthConditions] = useState(
    (dog?.health_conditions ?? []).join(', ')
  )
  const [bowlDiameterCm, setBowlDiameterCm] = useState(
    dog?.bowl_diameter_cm != null ? String(dog.bowl_diameter_cm) : ''
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const weight = Number(weightKg)
    if (!name.trim()) {
      toast.error('Please enter a name')
      return
    }
    if (!weight || weight <= 0) {
      toast.error('Please enter a valid weight')
      return
    }

    const input: DogInput = {
      name: name.trim(),
      breed: breed.trim() || null,
      weight_kg: weight,
      ideal_weight_kg: idealWeightKg ? Number(idealWeightKg) : null,
      birth_date: birthDate || null,
      life_stage: lifeStage,
      activity_level: activityLevel,
      neutered,
      health_conditions: healthConditions
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      bowl_diameter_cm: bowlDiameterCm ? Number(bowlDiameterCm) : null,
    }

    setIsSaving(true)
    try {
      const saved = dog ? await updateDog(dog.id, input) : await createDog(input)
      toast.success(dog ? `Updated ${saved.name}` : `Added ${saved.name}`)
      setOpen(false)
      onSaved?.(saved)
    } catch (error) {
      console.error('Save dog error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to save dog'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dog ? `Edit ${dog.name}` : 'Add a dog'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dog-name">Name</Label>
            <Input
              id="dog-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Rex"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dog-breed">Breed (optional)</Label>
            <Input
              id="dog-breed"
              value={breed}
              onChange={e => setBreed(e.target.value)}
              placeholder="Labrador Retriever"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dog-weight">Weight (kg)</Label>
              <Input
                id="dog-weight"
                type="number"
                min="0.1"
                step="0.1"
                value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dog-ideal-weight">Ideal weight (kg)</Label>
              <Input
                id="dog-ideal-weight"
                type="number"
                min="0.1"
                step="0.1"
                value={idealWeightKg}
                onChange={e => setIdealWeightKg(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dog-birth-date">Birth date (optional)</Label>
            <Input
              id="dog-birth-date"
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Life stage</Label>
              <Select
                value={lifeStage}
                onValueChange={v => setLifeStage(v as DogLifeStage)}
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
                onValueChange={v => setActivityLevel(v as DogActivityLevel)}
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
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="dog-neutered" className="cursor-pointer">
              Spayed / neutered
            </Label>
            <Switch
              id="dog-neutered"
              checked={neutered}
              onCheckedChange={setNeutered}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dog-bowl-diameter">Bowl diameter (cm, optional)</Label>
            <Input
              id="dog-bowl-diameter"
              type="number"
              min="1"
              step="0.5"
              value={bowlDiameterCm}
              onChange={e => setBowlDiameterCm(e.target.value)}
              placeholder="e.g. 20"
            />
            <p className="text-xs text-muted-foreground">
              Measure the bowl&apos;s inner rim once — photo scans use it as a
              size reference to pre-estimate portion grams.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dog-health">
              Health conditions (comma-separated, optional)
            </Label>
            <Input
              id="dog-health"
              value={healthConditions}
              onChange={e => setHealthConditions(e.target.value)}
              placeholder="e.g. kidney disease, allergies"
            />
            <p className="text-xs text-muted-foreground">
              Dogs with health conditions get a consult-your-vet notice on
              every meal.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {dog ? 'Save changes' : 'Add dog'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
