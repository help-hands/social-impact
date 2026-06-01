-- Incoming donation edits are only allowed while the record is pending.
-- Admins keep full update access through existing admin policies.

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

  if old.status <> 'pending' then
    raise exception 'Only pending donation records can be edited by users.';
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

drop policy if exists "owners can update editable incoming donations" on public.donations_in;
create policy "owners can update editable incoming donations"
on public.donations_in for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
  and deleted_at is null
)
with check (
  user_id = auth.uid()
  and status = 'pending'
  and deleted_at is null
);
