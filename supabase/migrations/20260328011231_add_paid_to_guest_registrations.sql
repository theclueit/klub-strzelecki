ALTER TABLE guest_registrations ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;
