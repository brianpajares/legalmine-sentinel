-- LegalMine Sentinel — monthly territorial corpus
--
-- Assessments used to query every official layer live, at request time. That
-- made them slow, fragile when a source was down, and not reproducible: once
-- INGEMMET edits a record, a dossier issued months ago can no longer be
-- re-derived, so it stops being defensible evidence.
--
-- The corpus harvests each source into an immutable, dated snapshot. An
-- assessment names the snapshot it was computed against, and the difference
-- between two consecutive months is what the monitoring subscription sells.

create table if not exists lm_corpus_snapshots (
  id           text primary key,
  source_key   text not null,
  period       text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status       text not null check (status in ('BUILDING', 'ACTIVE', 'SUPERSEDED', 'FAILED')),
  layer_url    text,
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  record_count integer not null default 0,
  checksum     text,
  cursor       integer not null default 0,
  payload      jsonb not null,
  unique (source_key, period)
);

-- At most one ACTIVE snapshot per source: assessments must never be able to
-- read two different months of the same layer.
create unique index if not exists lm_corpus_snapshots_one_active
  on lm_corpus_snapshots (source_key)
  where status = 'ACTIVE';

create index if not exists lm_corpus_snapshots_period_idx
  on lm_corpus_snapshots (source_key, period desc);

create table if not exists lm_corpus_records (
  snapshot_id text not null references lm_corpus_snapshots (id) on delete cascade,
  source_key  text not null,
  external_id text not null,
  -- Bounding box as plain columns rather than jsonb: this is the prefilter that
  -- keeps a national cadastre queryable, and it has to be index-backed.
  min_x       double precision,
  min_y       double precision,
  max_x       double precision,
  max_y       double precision,
  checksum    text not null,
  geometry    jsonb,
  attributes  jsonb not null,
  primary key (snapshot_id, external_id)
);

create index if not exists lm_corpus_records_bbox_idx
  on lm_corpus_records (snapshot_id, min_x, max_x, min_y, max_y);

create index if not exists lm_corpus_records_source_idx
  on lm_corpus_records (source_key, external_id);

-- A sealed snapshot is evidence. Editing one would silently rewrite the basis
-- of every dossier that cites it, so the database refuses.
create or replace function lm_corpus_records_block_write() returns trigger as $$
declare
  snapshot_status text;
begin
  select status into snapshot_status
    from lm_corpus_snapshots
   where id = coalesce(new.snapshot_id, old.snapshot_id);

  if snapshot_status in ('ACTIVE', 'SUPERSEDED') then
    raise exception
      'Snapshot % is sealed. Harvest a new period instead of editing it.',
      coalesce(new.snapshot_id, old.snapshot_id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists lm_corpus_records_immutable on lm_corpus_records;
create trigger lm_corpus_records_immutable
  before update or delete on lm_corpus_records
  for each row execute function lm_corpus_records_block_write();

create table if not exists lm_watches (
  id                   text primary key,
  created_at           timestamptz not null default now(),
  project_id           text not null,
  org_id               text not null,
  active               boolean not null default true,
  cadence              text not null default 'monthly',
  last_reported_period text,
  payload              jsonb not null
);
create index if not exists lm_watches_active_idx on lm_watches (active, created_at desc);
create index if not exists lm_watches_project_idx on lm_watches (project_id);

create table if not exists lm_watch_reports (
  id           text primary key,
  generated_at timestamptz not null default now(),
  watch_id     text not null references lm_watches (id) on delete cascade,
  project_id   text not null,
  period       text not null,
  change_count integer not null default 0,
  quiet        boolean not null default true,
  payload      jsonb not null,
  unique (watch_id, period)
);
create index if not exists lm_watch_reports_watch_idx
  on lm_watch_reports (watch_id, period desc);
