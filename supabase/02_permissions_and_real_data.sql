-- StalMind Business V2
-- Permissões necessárias para o frontend usar o banco real.
-- RLS permanece ativo e continua isolando cada organization_id.

grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.quotes to authenticated;
grant select, insert, update, delete on table public.quote_items to authenticated;
grant select, insert, update, delete on table public.sales to authenticated;
grant select, insert, update, delete on table public.sale_items to authenticated;

-- Garante que as policies de isolamento existem para as tabelas usadas agora.
drop policy if exists "customers_all_org" on public.customers;
create policy "customers_all_org"
on public.customers
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "quotes_all_org" on public.quotes;
create policy "quotes_all_org"
on public.quotes
for all to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

drop policy if exists "quote_items_via_quote" on public.quote_items;
create policy "quote_items_via_quote"
on public.quote_items
for all to authenticated
using (
  exists (
    select 1 from public.quotes q
    where q.id = quote_id
      and public.is_org_member(q.organization_id)
  )
)
with check (
  exists (
    select 1 from public.quotes q
    where q.id = quote_id
      and public.is_org_member(q.organization_id)
  )
);
