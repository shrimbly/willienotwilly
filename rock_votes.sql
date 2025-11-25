create table if not exists rock_votes (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  first_not_rock int not null,
  created_at timestamptz default now()
);

alter table rock_votes enable row level security;

create policy if not exists "allow insert for anon"
  on rock_votes
  for insert
  to anon
  with check (true);

create index if not exists rock_votes_model_idx on rock_votes (model);
