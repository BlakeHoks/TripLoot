import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { TopBar } from '@/components/TopBar'
import { Button } from '@/components/Button'
import { ErrorState, LoadingState } from '@/components/States'
import { useAuth, useUser } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/errors'
import { emailName } from '@/lib/format'
import type { Profile } from '@/types/database'
import { useProfile, useUpdateProfile } from './api'

export function ProfilePage() {
  const user = useUser()
  const { signOut } = useAuth()
  const profile = useProfile(user.id)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not sign out.'))
      setSigningOut(false)
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <TopBar back="/" title="Profile" />
      {profile.isPending ? (
        <LoadingState />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <ProfileForm userId={user.id} email={user.email ?? ''} profile={profile.data} />
      )}
      <Button variant="danger" className="w-full" loading={signingOut} onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </div>
  )
}

function ProfileForm({ userId, email, profile }: { userId: string; email: string; profile: Profile | null }) {
  const update = useUpdateProfile(userId)
  const [name, setName] = useState(profile?.display_name ?? emailName(email))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      await update.mutateAsync(trimmed)
      toast.success('Saved')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not save your name.'))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-5">
      <div className="flex flex-col items-center py-2">
        <span className="flex size-20 items-center justify-center rounded-full bg-accent-soft text-3xl font-black text-accent-strong">
          {(name.trim() || '?').slice(0, 1).toUpperCase()}
        </span>
        <p className="mt-2 font-semibold text-ink-soft">{email}</p>
      </div>
      <div>
        <label htmlFor="display-name" className="label">
          Display name
        </label>
        <input
          id="display-name"
          className="input"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          placeholder="How friends see you"
        />
        <p className="mt-1.5 text-sm text-ink-soft">Shown to friends in your trips.</p>
      </div>
      <Button type="submit" className="w-full" loading={update.isPending} disabled={!name.trim()}>
        Save
      </Button>
    </form>
  )
}
