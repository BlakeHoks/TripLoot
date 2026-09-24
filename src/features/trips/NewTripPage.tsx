import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/Button'
import { EmojiField } from '@/components/EmojiField'
import { getErrorMessage } from '@/lib/errors'
import { useCreateTrip } from './api'
import { TRIP_EMOJIS } from './constants'

export function NewTripPage() {
  const navigate = useNavigate()
  const createTrip = useCreateTrip()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('✈️')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [withDefaults, setWithDefaults] = useState(true)
  const datesInvalid = !!startDate && !!endDate && endDate < startDate

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || datesInvalid) return
    try {
      const trip = await createTrip.mutateAsync({
        name: name.trim(),
        emoji: emoji.trim() || '✈️',
        startDate,
        endDate,
        withDefaultCounters: withDefaults,
      })
      toast.success(`${trip.emoji} ${trip.name} created`)
      navigate(`/trips/${trip.id}`, { replace: true })
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not create the trip.'))
    }
  }

  return (
    <>
      <TopBar back="/" title="New trip" />
      <form onSubmit={handleSubmit} className="card space-y-5 p-5">
        <div>
          <span className="label">Emoji</span>
          <EmojiField value={emoji} onChange={setEmoji} suggestions={TRIP_EMOJIS} />
        </div>
        <div>
          <label htmlFor="trip-name" className="label">
            Name
          </label>
          <input
            id="trip-name"
            className="input"
            placeholder="Georgia 2026"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="trip-start" className="label">
              Start
            </label>
            <input id="trip-start" type="date" className="input text-base" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="trip-end" className="label">
              End
            </label>
            <input id="trip-end" type="date" className="input text-base" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        {datesInvalid && <p className="font-semibold text-danger">End date must be after the start date.</p>}

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-canvas p-4">
          <input
            type="checkbox"
            checked={withDefaults}
            onChange={(e) => setWithDefaults(e.target.checked)}
            className="mt-1 size-5 accent-accent"
          />
          <span>
            <span className="block font-extrabold">Add starter counters</span>
            <span className="block text-2xl tracking-widest">🥟🍷🍺🐈🚕☕</span>
            <span className="block text-sm text-ink-soft">You can delete any of them later.</span>
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" loading={createTrip.isPending} disabled={!name.trim() || datesInvalid}>
          Create trip
        </Button>
      </form>
    </>
  )
}
