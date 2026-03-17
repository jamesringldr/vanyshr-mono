-- Add about column to brokers.brokers
-- Stores a short descriptive snippet about the broker shown in the UI.

ALTER TABLE brokers.brokers
  ADD COLUMN about text;
