-- LegalMine Sentinel — durable storage schema
-- Apply this before pointing a deployment at SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
--
-- The API writes the full domain object into `payload` and mirrors the columns
-- it needs to filter or aggregate on. That keeps the assessment reproducible
-- byte for byte (Plan Maestro §5.4: re-running with new data must never
-- overwrite a historical result) while still allowing SQL reporting.

create extension if not exists "pgcrypto";

create table if not exists lm_projects (
  id            text primary key,
  created_at    timestamptz not null default now(),
  name          text not null,
  geometry_hash text not null,
  demo          boolean not null default false,
  payload       jsonb not null
);
create index if not exists lm_projects_created_at_idx on lm_projects (created_at desc);
create index if not exists lm_projects_geometry_hash_idx on lm_projects (geometry_hash);

create table if not exists lm_assessments (
  id                text primary key,
  created_at        timestamptz not null default now(),
  project_id        text not null,
  rule_version      text not null,
  overall_risk      numeric not null,
  confidence        numeric not null,
  assessment_status text not null,
  payload           jsonb not null
);
create index if not exists lm_assessments_created_at_idx on lm_assessments (created_at desc);
create index if not exists lm_assessments_project_idx on lm_assessments (project_id);

-- Assessments are immutable once written: a re-run creates a new row so the
-- dossier of an older decision can always be reproduced.
create or replace function lm_assessments_block_update() returns trigger as $$
begin
  raise exception 'Assessments are immutable. Run a new assessment instead of updating %', old.id;
end;
$$ language plpgsql;

drop trigger if exists lm_assessments_no_update on lm_assessments;
create trigger lm_assessments_no_update
  before update on lm_assessments
  for each row execute function lm_assessments_block_update();

create table if not exists lm_report_events (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  assessment_id text not null
);
create index if not exists lm_report_events_assessment_idx on lm_report_events (assessment_id);

create table if not exists lm_pilot_feedback (
  id              text primary key,
  created_at      timestamptz not null default now(),
  assessment_id   text,
  usefulness      integer not null,
  would_use_again boolean not null default false,
  payload         jsonb not null
);
create index if not exists lm_pilot_feedback_created_at_idx on lm_pilot_feedback (created_at desc);

create table if not exists lm_leads (
  id          text primary key,
  created_at  timestamptz not null default now(),
  email       text not null,
  lead_source text not null default 'website',
  payload     jsonb not null
);
create index if not exists lm_leads_created_at_idx on lm_leads (created_at desc);

-- Row level security is enabled on every table and no policy is granted, so the
-- anon and authenticated roles cannot read anything. The application reaches
-- these tables only through the service role key held server-side.
alter table lm_projects       enable row level security;
alter table lm_assessments    enable row level security;
alter table lm_report_events  enable row level security;
alter table lm_pilot_feedback enable row level security;
alter table lm_leads          enable row level security;
