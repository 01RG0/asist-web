-- Add notes column to attendance table for manual attendance records
ALTER TABLE attendance ADD COLUMN notes TEXT NULL AFTER delay_minutes;