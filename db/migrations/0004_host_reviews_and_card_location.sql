ALTER TABLE activities ADD COLUMN shawn_rating INTEGER CHECK (shawn_rating IS NULL OR (shawn_rating BETWEEN 1 AND 5 AND shawn_rating = CAST(shawn_rating AS INTEGER)));
ALTER TABLE activities ADD COLUMN sun_rating INTEGER CHECK (sun_rating IS NULL OR (sun_rating BETWEEN 1 AND 5 AND sun_rating = CAST(sun_rating AS INTEGER)));
ALTER TABLE activities ADD COLUMN card_location TEXT;
