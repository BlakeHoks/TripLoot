import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/Button'
import { EmojiField } from '@/components/EmojiField'
import { getErrorMessage } from '@/lib/errors'
import type { Trip } from '@/types/database'
import { useUpdateTrip } from './api'
import { TRIP_EMOJIS } from './constants'

export function TripSettingsCard({ trip }: { trip: Trip }) {
  const update = useUpdateTrip(trip.id)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(trip.name)
  const [emoji, setEmoji] = useState(trip.emoji)
  const [startDate, setStartDate] = useState(trip.start_date ?? '')
  const [endDate, setEndDate] = useState(trip.end_date ?? '')
  const datesInvalid = !!startDate && !!endDate && endDate < startDate

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || datesInvalid) return
    try {
      await update.mutateAsync({
        name: name.trim(),
        emoji: emoji.trim() || '✈️',
        start_date: startDate || null,
        end_date: endDate || null,
      })
      toast.success('Trip updated')
      setOpen(false)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not update the trip.'))
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        ✏️ Edit trip
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <p className="text-lg font-extrabold">Edit trip</p>
      <EmojiField value={emoji} onChange={setEmoji} suggestions={TRIP_EMOJIS} />
      <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Trip name" />
      <div className="grid grid-cols-2 gap-3">
        <input type="date" className="input text-base" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-label="Start date" />
        <input type="date" className="input text-base" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} aria-label="End date" />
      </div>
      {datesInvalid && <p className="font-semibold text-danger">End date must be after the start date.</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" loading={update.isPending} disabled={!name.trim() || datesInvalid}>
          Save
        </Button>
      </div>
    </form>
  )
}
