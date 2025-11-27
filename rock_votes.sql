create table if not exists rock_votes (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  first_not_rock int not null,
  voter_ip text,
  created_at timestamptz default now()
);

alter table rock_votes enable row level security;

create policy if not exists "allow insert for anon"
  on rock_votes
  for insert
  to anon
  with check (true);

create policy if not exists "allow select for anon"
  on rock_votes
  for select
  to anon
  using (true);

create index if not exists rock_votes_model_idx on rock_votes (model);
create index if not exists rock_votes_rate_limit_idx on rock_votes (model, voter_ip, created_at);

-- Migration for existing tables (run if table already exists):
-- alter table rock_votes add column if not exists voter_ip text;
-- create index if not exists rock_votes_rate_limit_idx on rock_votes (model, voter_ip, created_at);
