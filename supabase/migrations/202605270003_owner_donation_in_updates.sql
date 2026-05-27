-- Allow users to edit their own incoming donations until an admin approves them.
-- Owners cannot change status or donor ownership; admins keep full update access.

create or replace function public.guard_owner_donation_in_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' or public.is_admin() then
    return new;
  end if;

  if old.user_id <> auth.uid() then
    raise exception 'You can only edit your own donation records.';
  end if;

  if old.status = 'success' then
    raise exception 'Approved donation records cannot be edited by users.';
  end if;

  if new.user_id <> old.user_id then
    raise exception 'Donation donor cannot be changed by users.';
  end if;

  if new.status <> old.status then
    raise exception 'Donation status cannot be changed by users.';
  end if;

  return new;
end;
$$;

drop trigger if exists donations_in_guard_owner_update on public.donations_in;
create trigger donations_in_guard_owner_update
before update on public.donations_in
for each row execute function public.guard_owner_donation_in_update();

drop policy if exists "owners can update editable incoming donations" on public.donations_in;
create policy "owners can update editable incoming donations"
on public.donations_in for update
to authenticated
using (
  user_id = auth.uid()
  and status <> 'success'
)
with check (
  user_id = auth.uid()
  and status <> 'success'
);
