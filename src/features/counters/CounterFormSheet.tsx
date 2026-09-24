import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Sheet } from '@/components/Sheet'
import { Button } from '@/components/Button'
import { EmojiField } from '@/components/EmojiField'
import { getErrorMessage } from '@/lib/errors'
import type { CounterWithTotal } from '@/types/database'
import { useCreateCounter, useDeleteCounter, useUpdateCounter } from './api'

const EMOJI_SUGGESTIONS = ['🥟', '🍷', '🍺', '🐈', '🚕', '☕', '🍕', '🥃', '📸', '🏛️', '🚶', '🍦', '🐕', '😴']

type Props = {
  tripId: string
  open: boolean
  onClose: () => void
  /** Edit this counter; create a new one when null. */
  counter: CounterWithTotal | null
}

export function CounterFormSheet({ tripId, open, onClose, counter }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={counter ? 'Edit counter' : 'New counter'}>
      <CounterForm key={`${open}-${counter?.id}`} tripId={tripId} counter={counter} onDone={onClose} />
    </Sheet>
  )
}

function CounterForm({ tripId, counter, onDone }: { tripId: string; counter: CounterWithTotal | null; onDone: () => void }) {
  const [emoji, setEmoji] = useState(counter?.emoji ?? '🍕')
  const [name, setName] = useState(counter?.name ?? '')
  const [unit, setUnit] = useState(counter?.unit ?? '')
  const create = useCreateCounter(tripId)
  const update = useUpdateCounter(tripId)
  const remove = useDeleteCounter(tripId)
  const busy = create.isPending || update.isPending || remove.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const input = { emoji: emoji.trim() || '⭐', name: name.trim(), unit: unit.trim() || null }
    if (!input.name) return
    try {
      if (counter) {
        await update.mutateAsync({ id: counter.id, ...input })
        toast.success('Counter updated')
      } else {
        await create.mutateAsync(input)
        toast.success(`${input.emoji} ${input.name} added`)
      }
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save the counter.'))
    }
  }

  async function handleDelete() {
    if (!counter) return
    const events = counter.event_count
    const warning = events > 0 ? `\n\nThis also deletes its ${events} event${events === 1 ? '' : 's'}.` : ''
    if (!window.confirm(`Delete “${counter.name}”?${warning}`)) return
    try {
      await remove.mutateAsync(counter.id)
      toast.success('Counter deleted')
      onDone()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not delete the counter.'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <span className="label">Emoji</span>
        <EmojiField value={emoji} onChange={setEmoji} suggestions={EMOJI_SUGGESTIONS} />
      </div>
      <div>
        <label htmlFor="counter-name" className="label">
          Name
        </label>
        <input
          id="counter-name"
          className="input"
          placeholder="Pizza slices"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!counter}
        />
      </div>
      <div>
        <label htmlFor="counter-unit" className="label">
          Unit <span className="font-medium">(optional)</span>
        </label>
        <input
          id="counter-unit"
          className="input"
          placeholder="pcs."
          value={unit}
          maxLength={20}
          onChange={(e) => setUnit(e.target.value)}
        />
      </div>
      <Button type="submit" size="lg" className="w-full" loading={create.isPending || update.isPending} disabled={!name.trim() || busy}>
        {counter ? 'Save' : 'Create counter'}
      </Button>
      {counter && (
        <Button variant="danger" className="w-full" loading={remove.isPending} disabled={busy} onClick={handleDelete}>
          Delete counter
        </Button>
      )}
    </form>
  )
}
