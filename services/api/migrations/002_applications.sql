create table applications (
  id uuid primary key default gen_random_uuid(),
  opening_id uuid not null references job_openings (id),
  candidate_name text not null check (btrim(candidate_name) <> ''),
  candidate_email text not null check (btrim(candidate_email) <> ''),
  created_at timestamptz not null default now()
);

create index applications_candidate_email_idx on applications (candidate_email);
create index applications_opening_id_idx on applications (opening_id);
