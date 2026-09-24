export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  trips: ['trips'] as const,
  trip: (tripId: string) => ['trip', tripId] as const,
  counters: (tripId: string) => ['counters', tripId] as const,
  events: (tripId: string) => ['events', tripId] as const,
  members: (tripId: string) => ['members', tripId] as const,
  invite: (tripId: string) => ['invite', tripId] as const,
  invitePreview: (token: string) => ['invite-preview', token] as const,
}
