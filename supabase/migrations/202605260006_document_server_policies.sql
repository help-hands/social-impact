-- Allow server-side document writes from Apps Script service role.
-- Browser users still upload through Apps Script; direct authenticated inserts are not granted.

drop policy if exists "service role can insert documents" on public.documents;
create policy "service role can insert documents"
on public.documents for insert
to service_role
with check (true);

drop policy if exists "service role can update documents" on public.documents;
create policy "service role can update documents"
on public.documents for update
to service_role
using (true)
with check (true);

drop policy if exists "service role can read documents" on public.documents;
create policy "service role can read documents"
on public.documents for select
to service_role
using (true);

drop policy if exists "service role can update incoming donations" on public.donations_in;
create policy "service role can update incoming donations"
on public.donations_in for update
to service_role
using (true)
with check (true);

drop policy if exists "service role can update outgoing donations" on public.donations_out;
create policy "service role can update outgoing donations"
on public.donations_out for update
to service_role
using (true)
with check (true);
