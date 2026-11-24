create table hiring_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table job_openings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  hiring_manager_id uuid not null references hiring_managers (id),
  vacancies integer not null check (vacancies >= 1),
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  created_at timestamptz not null default now()
);
