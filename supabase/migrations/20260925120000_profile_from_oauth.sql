-- Use the name / avatar that OAuth providers (Google) put into user metadata
-- when creating a profile. Magic-link users still fall back to the email prefix.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
        nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '')
      ),
      50
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- Existing users who signed in with an OAuth provider but still carry the
-- email-prefix default get their provider name/avatar once.
update public.profiles p
set
  display_name = left(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), 50),
  avatar_url = coalesce(p.avatar_url, u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
where u.id = p.id
  and nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), '') is not null
  and p.display_name is not distinct from left(nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''), 50);
