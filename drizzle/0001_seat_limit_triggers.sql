-- A car can't hold more kids than its seats. SQLite serializes writes, so these checks
-- hold even when two parents claim the last seat at the same moment.
CREATE TRIGGER `ride_assignments_seat_limit`
BEFORE INSERT ON `ride_assignments`
WHEN (SELECT count(*) FROM `ride_assignments` WHERE `driver_id` = NEW.`driver_id`)
  >= (SELECT `seats` FROM `drivers` WHERE `id` = NEW.`driver_id`)
BEGIN
  SELECT RAISE(ABORT, 'car_full');
END;
--> statement-breakpoint
CREATE TRIGGER `drivers_seats_not_below_riders`
BEFORE UPDATE OF `seats` ON `drivers`
WHEN NEW.`seats` < (SELECT count(*) FROM `ride_assignments` WHERE `driver_id` = NEW.`id`)
BEGIN
  SELECT RAISE(ABORT, 'seats_below_riders');
END;
