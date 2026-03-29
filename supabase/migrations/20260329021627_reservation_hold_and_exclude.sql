-- 1. Enable btree_gist extension (needed for EXCLUDE with = and range operators)
create extension if not exists btree_gist;

-- 2. Add hold columns to lane_reservations
alter table lane_reservations
  add column if not exists hold_token uuid,
  add column if not exists hold_expires_at timestamptz;

-- 3. Add EXCLUDE constraint preventing overlapping reservations on same lane+station+date
-- This prevents race conditions: only one reservation can occupy a given time range
-- on a given lane/station/date. Cancelled and expired holds are excluded via partial index.
alter table lane_reservations
  add constraint lane_reservations_no_overlap
  exclude using gist (
    lane_id with =,
    station_number with =,
    reservation_date with =,
    tsrange(
      (reservation_date + start_time)::timestamp,
      (reservation_date + end_time)::timestamp
    ) with &&
  )
  where (status != 'cancelled');

-- 4. Index for fast cleanup of expired holds
create index if not exists idx_lane_reservations_hold_expires
  on lane_reservations (hold_expires_at)
  where hold_token is not null and hold_expires_at is not null;

-- 5. Function to clean up expired holds (called before queries and periodically)
create or replace function cleanup_expired_holds()
returns void as $$
begin
  update lane_reservations
  set status = 'cancelled'
  where hold_token is not null
    and hold_expires_at < now()
    and status != 'cancelled';
end;
$$ language plpgsql;
