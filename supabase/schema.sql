-- Execute no SQL Editor do Supabase.
-- O servidor guarda apenas texto cifrado: título, usuário, senha e notas nunca saem legíveis do navegador.
create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  iv text not null,
  ciphertext text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vault_items_user_idx on public.vault_items(user_id);

alter table public.vault_items enable row level security;

create policy "ver proprios itens" on public.vault_items
  for select using (auth.uid() = user_id);
create policy "criar proprios itens" on public.vault_items
  for insert with check (auth.uid() = user_id);
create policy "editar proprios itens" on public.vault_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "apagar proprios itens" on public.vault_items
  for delete using (auth.uid() = user_id);
