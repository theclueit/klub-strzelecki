-- 1. Create login_history table
create table if not exists login_history (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  auth_id uuid,
  email text,
  full_name text,
  ip_address text,
  user_agent text,
  event_type text not null default 'login', -- login, logout, token_refresh
  created_at timestamptz not null default now()
);

-- 2. Index for fast lookups
create index if not exists idx_login_history_member on login_history(member_id);
create index if not exists idx_login_history_created on login_history(created_at desc);

-- 3. RLS
alter table login_history enable row level security;

-- Superadmins and admins can read all login history
create policy "superadmin_read_login_history" on login_history
  for select using (
    exists (
      select 1 from members m
      where m.auth_id = auth.uid()
      and m.role in ('superadmin', 'admin')
    )
  );

-- Service role can insert (from API)
create policy "service_insert_login_history" on login_history
  for insert with check (true);
