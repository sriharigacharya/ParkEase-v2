// server/routes/employee.js
import express from 'express';
import { query as dbQuery } from '../config/database.js'; // Ensure this path is correct
import { verifyToken } from '../middleware/auth.js';
import dayjs from 'dayjs';

const router = express.Router();

// Utility to simulate transaction handling if your dbQuery doesn't natively support it directly in one call
// In a real app, your database connection object would have commit/rollback methods.
// This is a conceptual placeholder. Replace with your actual transaction logic.
const DUMMY_TRANSACTION_WRAPPER = async (callback) => {
    // console.log("DUMMY_TRANSACTION: START"); // Conceptual: await db.beginTransaction();
    try {
        const result = await callback();
        // console.log("DUMMY_TRANSACTION: COMMIT"); // Conceptual: await db.commit();
        return result;
    } catch (error) {
        // console.error("DUMMY_TRANSACTION: ROLLBACK", error); // Conceptual: await db.rollback();
        throw error; // Re-throw the error to be caught by the route's catch block
    }
};


const checkEmployeeAndLoadLocation = async (req, res, next) => {
  if (!req.user || req.user.role !== 'employee') {
    return res.status(403).json({ message: 'Access denied. Employee role required.' });
  }
  if (!req.user.parkingLocationId) {
    return res.status(403).json({ message: 'No parking location assigned to this employee account.' });
  }
  try {
    const [location] = await dbQuery('SELECT id, name, total_slots, available_slots FROM parking_locations WHERE id = ?', [req.user.parkingLocationId]);
    if (!location) {
      return res.status(404).json({ message: 'Assigned parking location not found.' });
    }
    req.employeeLocationId = location.id;
    req.locationInfo = {
        id: location.id,
        name: location.name,
        total_slots: parseInt(location.total_slots, 10),
        available_slots: parseInt(location.available_slots, 10)
    };
    next();
  } catch (error) {
    console.error('Error in checkEmployeeAndLoadLocation middleware:', error);
    return res.status(500).json({ message: 'Server error validating employee location.' });
  }
};

router.get('/location', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
  res.json({
      id: req.locationInfo.id,
      name: req.locationInfo.name,
      totalSlots: req.locationInfo.total_slots,
      availableSlots: req.locationInfo.available_slots
  });
});

router.get('/vehicles', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
  try {
    const allSessionsData = await dbQuery(
      `SELECT id, license_plate, entry_time, exit_time, cost, booking_id 
       FROM vehicle_sessions 
       WHERE parking_location_id = ? 
       ORDER BY entry_time DESC 
       LIMIT 100`,
      [req.employeeLocationId]
    );
    res.json(allSessionsData.map(v => ({
        id: v.id,
        licensePlate: v.license_plate,
        entryTime: v.entry_time,
        exitTime: v.exit_time,
        cost: v.cost,
        bookingId: v.booking_id
    })));
  } catch (error) {
    console.error('Error fetching vehicle sessions:', error);
    res.status(500).json({ message: 'Failed to fetch vehicle sessions.' });
  }
});

router.post('/checkin', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
  const { licensePlate } = req.body;
  if (!licensePlate || typeof licensePlate !== 'string' || licensePlate.trim() === '') {
    return res.status(400).json({ message: 'License plate is required.' });
  }
  const cleanLicensePlate = licensePlate.toUpperCase().trim();

  try {
    await DUMMY_TRANSACTION_WRAPPER(async () => { // Wrap in conceptual transaction
        const [locationForUpdate] = await dbQuery('SELECT available_slots FROM parking_locations WHERE id = ? FOR UPDATE', [req.employeeLocationId]);
        if (locationForUpdate.available_slots <= 0) {
          throw { status: 400, message: 'No available parking slots for drive-up.' };
        }

        const [activeSession] = await dbQuery(
            'SELECT id FROM vehicle_sessions WHERE license_plate = ? AND parking_location_id = ? AND exit_time IS NULL',
            [cleanLicensePlate, req.employeeLocationId]
        );
        if (activeSession) {
            throw { status: 400, message: `Vehicle ${cleanLicensePlate} is already actively parked at this location.` };
        }

        const entryTime = new Date();
        const result = await dbQuery(
          'INSERT INTO vehicle_sessions (parking_location_id, license_plate, entry_time, employee_id_check_in) VALUES (?, ?, ?, ?)',
          [req.employeeLocationId, cleanLicensePlate, entryTime, req.user.id]
        );
        await dbQuery('UPDATE parking_locations SET available_slots = available_slots - 1 WHERE id = ? AND available_slots > 0', [req.employeeLocationId]);
        
        res.status(201).json({ 
            message: 'Vehicle checked in successfully.', 
            vehicleSessionId: result.insertId,
        });
    });
  } catch (error) {
    console.error('Error checking in drive-up vehicle:', error.message || error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to check in vehicle.' });
  }
});

router.post('/checkout', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
  const { vehicleId } = req.body;
  if (!vehicleId || isNaN(parseInt(vehicleId, 10))) {
    return res.status(400).json({ message: 'Valid Vehicle ID is required.' });
  }
  const numericVehicleId = parseInt(vehicleId, 10);

  try {
    await DUMMY_TRANSACTION_WRAPPER(async () => { // Wrap in conceptual transaction
        const [session] = await dbQuery(
          'SELECT id, license_plate, entry_time, exit_time, booking_id, parking_location_id FROM vehicle_sessions WHERE id = ? AND parking_location_id = ? FOR UPDATE',
          [numericVehicleId, req.employeeLocationId]
        );

        if (!session) {
          throw { status: 404, message: 'Vehicle session not found at your location.' };
        }
        if (session.exit_time) {
          throw { status: 400, message: 'Vehicle already checked out.' };
        }
        
        const [locationForUpdate] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ? FOR UPDATE', [session.parking_location_id]); // Use session's location_id
        const [rateSetting] = await dbQuery("SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1");
        const hourlyRate = parseFloat(rateSetting?.hourly_rate || "0");

        const exitTime = new Date();
        const entryTime = new Date(session.entry_time);
        const durationMs = exitTime.getTime() - entryTime.getTime();
        const durationHours = durationMs > 0 ? Math.max(0.25, durationMs / (1000 * 60 * 60)) : 0;
        
        let cost = 0;
        if (hourlyRate > 0 && durationHours > 0) {
            cost = durationHours * hourlyRate;
            cost = Math.ceil(cost * 100) / 100; 
        }

        await dbQuery(
          'UPDATE vehicle_sessions SET exit_time = ?, cost = ?, employee_id_check_out = ? WHERE id = ?',
          [exitTime, cost, req.user.id, numericVehicleId]
        );

        if (session.booking_id) {
          await dbQuery(
            "UPDATE bookings SET status = 'completed', actual_exit_time = ?, final_cost = ?, employee_id_check_out = ? WHERE id = ? AND status = 'checked-in'",
            [exitTime, cost, req.user.id, session.booking_id]
          );
        }
        
        await dbQuery(
          'UPDATE parking_locations SET available_slots = LEAST(?, available_slots + 1) WHERE id = ?', 
          [locationForUpdate.total_slots, session.parking_location_id]
        );
        
        res.json({ 
          message: 'Vehicle checked out successfully.', 
          cost,
          licensePlate: session.license_plate,
          entryTime: session.entry_time,
          exitTime: exitTime.toISOString()
        });
    });
  } catch (error) {
    console.error('Error checking out vehicle:', error.message || error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to check out vehicle.' });
  }
});

router.get('/location-bookings', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
  try {
    const todayStart = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const todayEnd = dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss');
    const bookingsData = await dbQuery(
      `SELECT 
            b.id as bookingId, b.user_id as userId, u.name as userName, u.email as userEmail, 
            b.start_time as startTime, b.end_time as endTime, b.status, 
            b.license_plate_booked as licensePlateBooked,
            b.checked_in_license_plate as checkedInLicensePlate
       FROM bookings b
       JOIN users u ON b.user_id = u.id
       WHERE b.parking_location_id = ? 
         AND b.status IN ('confirmed', 'checked-in') 
         AND b.start_time <= ?
         AND b.end_time >= ?
       ORDER BY b.start_time ASC`,
      [req.employeeLocationId, todayEnd, todayStart]
    );
    res.json(bookingsData.map(b => ({
        bookingId: b.bookingId, userId: b.userId, userName: b.userName || b.userEmail,
        startTime: b.startTime, endTime: b.endTime, status: b.status,
        licensePlateBooked: b.licensePlateBooked, checkedInLicensePlate: b.checkedInLicensePlate,
    })));
  } catch (error) {
    console.error('Error fetching location bookings:', error);
    res.status(500).json({ message: 'Failed to fetch location bookings.' });
  }
});

router.post('/bookings/:bookingId/checkin', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
  const { bookingId } = req.params;
  const { licensePlate } = req.body;
  if (!bookingId || isNaN(parseInt(bookingId, 10))) return res.status(400).json({ message: 'Valid Booking ID required.' });
  if (!licensePlate || typeof licensePlate !== 'string' || licensePlate.trim() === '') return res.status(400).json({ message: 'License plate required for check-in.' });
  
  const numericBookingId = parseInt(bookingId, 10);
  const cleanLicensePlate = licensePlate.toUpperCase().trim();

  console.log(`[BOOKING CHECK-IN START] Booking ID: ${numericBookingId}, LP: ${cleanLicensePlate}, Loc: ${req.employeeLocationId}`);

  try {
    await DUMMY_TRANSACTION_WRAPPER(async () => { // Wrap in conceptual transaction
        const [booking] = await dbQuery('SELECT id, parking_location_id, status FROM bookings WHERE id = ? FOR UPDATE', [numericBookingId]);
        const [locationForUpdate] = await dbQuery('SELECT available_slots FROM parking_locations WHERE id = ? FOR UPDATE', [req.employeeLocationId]);

        if (!booking) throw { status: 404, message: 'Booking not found.' };
        if (booking.parking_location_id !== req.employeeLocationId) throw { status: 403, message: 'Booking not for your assigned location.' };
        if (booking.status !== 'confirmed') throw { status: 400, message: `Booking already ${booking.status}. Cannot check-in again.` };
        if (locationForUpdate.available_slots <= 0) throw { status: 400, message: 'No physical parking slots currently available, even for bookings.' };

        const entryTime = new Date();
        console.log(`[BOOKING CHECK-IN] Proceeding for Booking ID: ${numericBookingId}. Location available slots: ${locationForUpdate.available_slots}`);

        const sessionResult = await dbQuery(
          'INSERT INTO vehicle_sessions (parking_location_id, license_plate, entry_time, booking_id, employee_id_check_in) VALUES (?, ?, ?, ?, ?)',
          [req.employeeLocationId, cleanLicensePlate, entryTime, numericBookingId, req.user.id]
        );
        console.log(`[BOOKING CHECK-IN] vehicle_sessions created for Booking ID: ${numericBookingId}, New Session ID: ${sessionResult.insertId}`);

        await dbQuery(
          "UPDATE bookings SET status = 'checked-in', checked_in_license_plate = ?, actual_entry_time = ?, employee_id_check_in = ? WHERE id = ?",
          [cleanLicensePlate, entryTime, req.user.id, numericBookingId]
        );
        console.log(`[BOOKING CHECK-IN] bookings table updated for Booking ID: ${numericBookingId} to status 'checked-in'.`);
        
        await dbQuery('UPDATE parking_locations SET available_slots = available_slots - 1 WHERE id = ? AND available_slots > 0', [req.employeeLocationId]);
        console.log(`[BOOKING CHECK-IN] parking_locations.available_slots decremented for Location ID: ${req.employeeLocationId}`);
        
        res.json({ 
          message: `Booking ${numericBookingId} checked in successfully.`,
          vehicleSessionId: sessionResult.insertId
        });
    });
  } catch (error) {
    console.error(`[BOOKING CHECK-IN ERROR] Booking ID ${numericBookingId}:`, error.message || error);
    res.status(error.status || 500).json({ message: error.message || 'Failed to check in for booking.' });
  }
});

router.post('/bookings/:bookingId/cancel-by-employee', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
    const { bookingId } = req.params;
    const numericBookingId = parseInt(bookingId, 10);
    if (isNaN(numericBookingId)) return res.status(400).json({ message: 'Valid Booking ID is required.' });

    console.log(`[BOOKING CANCEL START] Booking ID: ${numericBookingId}`);
    try {
        await DUMMY_TRANSACTION_WRAPPER(async () => { // Wrap in conceptual transaction
            const [booking] = await dbQuery('SELECT id, parking_location_id, status FROM bookings WHERE id = ? FOR UPDATE', [numericBookingId]);
            
            if (!booking) throw { status: 404, message: 'Booking not found.' };
            if (booking.parking_location_id !== req.employeeLocationId) throw { status: 403, message: 'This booking is not for your assigned location.' };
            if (['cancelled', 'completed', 'checked-out'].includes(booking.status)) throw { status: 400, message: `Booking is already ${booking.status} and cannot be cancelled.` };

            const originalStatus = booking.status;
            console.log(`[BOOKING CANCEL INFO] Booking ID: ${numericBookingId}, Original Status: ${originalStatus}`);

            await dbQuery("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [numericBookingId]);
            console.log(`[BOOKING CANCEL INFO] Booking ID: ${numericBookingId} status updated to 'cancelled'.`);
            
            if (originalStatus === 'checked-in') {
                const [locationForUpdate] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ? FOR UPDATE', [req.employeeLocationId]);
                const exitTime = new Date();
                const updateSessionResult = await dbQuery(
                    "UPDATE vehicle_sessions SET exit_time = ?, cost = 0, employee_id_check_out = ? WHERE booking_id = ? AND exit_time IS NULL",
                    [exitTime, req.user.id, numericBookingId]
                );
                console.log(`[BOOKING CANCEL INFO] vehicle_session for Booking ID: ${numericBookingId} updated (exit_time, cost 0): ${JSON.stringify(updateSessionResult.affectedRows)} affected.`);
                
                if (updateSessionResult.affectedRows > 0) { // Only increment if a session was actually updated
                    await dbQuery(
                        'UPDATE parking_locations SET available_slots = LEAST(?, available_slots + 1) WHERE id = ?',
                        [locationForUpdate.total_slots, req.employeeLocationId]
                    );
                    console.log(`[BOOKING CANCEL INFO] parking_locations.available_slots incremented for Location ID: ${req.employeeLocationId}`);
                } else {
                    console.warn(`[BOOKING CANCEL WARN] No active vehicle session found to update for checked-in booking ${numericBookingId} being cancelled.`);
                }
            }
            res.json({ message: `Booking ID ${numericBookingId} cancelled successfully.` });
        });
    } catch (error) {
        console.error(`[BOOKING CANCEL ERROR] Booking ID ${numericBookingId}:`, error.message || error);
        res.status(error.status || 500).json({ message: error.message || 'Failed to cancel booking.' });
    }
});

router.post('/bookings/:bookingId/checkout', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
    const { bookingId } = req.params;
    const numericBookingId = parseInt(bookingId, 10);
    if (isNaN(numericBookingId)) return res.status(400).json({ message: 'Valid Booking ID is required.' });

    console.log(`[BOOKED CHECKOUT START] Booking ID: ${numericBookingId}, Loc: ${req.employeeLocationId}`);
    try {
        await DUMMY_TRANSACTION_WRAPPER(async () => { // Wrap in conceptual transaction
            const [bookingDetails] = await dbQuery(
                'SELECT id, status FROM bookings WHERE id = ? AND parking_location_id = ? FOR UPDATE',
                [numericBookingId, req.employeeLocationId]
            );

            if (!bookingDetails) throw { status: 404, message: 'Booking not found at your location.' };
            console.log(`[BOOKED CHECKOUT INFO] Booking ${numericBookingId} current status: ${bookingDetails.status}`);
            if (bookingDetails.status !== 'checked-in') throw { status: 400, message: `Booking status is '${bookingDetails.status}'. Only 'checked-in' bookings can be checked out.` };

            const [session] = await dbQuery(
                'SELECT id, entry_time FROM vehicle_sessions WHERE booking_id = ? AND parking_location_id = ? AND exit_time IS NULL FOR UPDATE',
                [numericBookingId, req.employeeLocationId]
            );

            if (!session) {
                console.error(`[BOOKED CHECKOUT FAIL] CRITICAL: No active vehicle session found for checked-in booking ID ${numericBookingId}.`);
                throw { status: 500, message: 'Data inconsistency: Active vehicle session for this booking not found. Cannot proceed with checkout.' };
            }
            console.log(`[BOOKED CHECKOUT INFO] Found session ID: ${session.id} for booking ${numericBookingId}. Entry time: ${session.entry_time}`);
            
            const [locationForUpdate] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ? FOR UPDATE', [req.employeeLocationId]);
            const [rateSetting] = await dbQuery("SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1");
            const hourlyRate = parseFloat(rateSetting?.hourly_rate || "0");

            const exitTime = new Date();
            const entryTime = new Date(session.entry_time);
            const durationMs = exitTime.getTime() - entryTime.getTime();
            const durationHours = durationMs > 0 ? Math.max(0.25, durationMs / (1000 * 60 * 60)) : 0;

            let cost = 0;
            if (hourlyRate > 0 && durationHours > 0) {
                cost = durationHours * hourlyRate;
                cost = Math.ceil(cost * 100) / 100;
            }
            console.log(`[BOOKED CHECKOUT INFO] Calculated cost: ${cost} for duration ${durationHours} hrs.`);

            await dbQuery('UPDATE vehicle_sessions SET exit_time = ?, cost = ?, employee_id_check_out = ? WHERE id = ?', [exitTime, cost, req.user.id, session.id]);
            console.log(`[BOOKED CHECKOUT INFO] vehicle_sessions updated for session ID: ${session.id}`);

            await dbQuery("UPDATE bookings SET status = 'completed', actual_exit_time = ?, final_cost = ?, employee_id_check_out = ? WHERE id = ?", [exitTime, cost, req.user.id, numericBookingId]);
            console.log(`[BOOKED CHECKOUT INFO] bookings table updated for Booking ID: ${numericBookingId} to status 'completed'.`);

            await dbQuery('UPDATE parking_locations SET available_slots = LEAST(?, available_slots + 1) WHERE id = ?', [locationForUpdate.total_slots, req.employeeLocationId]);
            console.log(`[BOOKED CHECKOUT INFO] parking_locations.available_slots incremented for Location ID: ${req.employeeLocationId}`);

            res.json({ message: `Booking ${numericBookingId} checked out successfully.`, cost });
        });
    } catch (error) {
        console.error(`[BOOKED CHECKOUT ERROR] Booking ID ${numericBookingId}:`, error.message || error);
        res.status(error.status || 500).json({ message: error.message || 'Failed to checkout booking by employee due to server error.' });
    }
});

export default router;



// // server/routes/employee.js
// import express from 'express';
// import { query as dbQuery } from '../config/database.js';
// import { verifyToken } from '../middleware/auth.js';
// import dayjs from 'dayjs';

// const router = express.Router();

// const checkEmployeeAndLoadLocation = async (req, res, next) => {
//   if (!req.user || req.user.role !== 'employee') {
//     return res.status(403).json({ message: 'Access denied. Employee role required.' });
//   }
//   if (!req.user.parkingLocationId) {
//     return res.status(403).json({ message: 'No parking location assigned to this employee account.' });
//   }
//   try {
//     const [location] = await dbQuery('SELECT id, name, total_slots, available_slots FROM parking_locations WHERE id = ?', [req.user.parkingLocationId]);
//     if (!location) {
//       return res.status(404).json({ message: 'Assigned parking location not found.' });
//     }
//     req.employeeLocationId = location.id;
//     req.locationInfo = { // Store for convenience
//         id: location.id,
//         name: location.name,
//         total_slots: location.total_slots,
//         available_slots: location.available_slots
//     };
//     next();
//   } catch (error) {
//     console.error('Error in checkEmployeeAndLoadLocation middleware:', error);
//     return res.status(500).json({ message: 'Server error validating employee location.' });
//   }
// };

// // GET Employee's Assigned Location Details
// router.get('/location', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
//   res.json({
//       id: req.locationInfo.id,
//       name: req.locationInfo.name,
//       totalSlots: req.locationInfo.total_slots,
//       availableSlots: req.locationInfo.available_slots
//   });
// });

// // GET Vehicle Sessions (Drive-ups) for the Employee's Location
// router.get('/vehicles', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
//   try {
//     const vehicleSessions = await dbQuery(
//       `SELECT id, license_plate, entry_time, exit_time, cost, booking_id 
//        FROM vehicle_sessions 
//        WHERE parking_location_id = ? 
//        ORDER BY entry_time DESC 
//        LIMIT 100`,
//       [req.employeeLocationId]
//     );
//     res.json(vehicleSessions.map(v => ({
//         id: v.id,
//         licensePlate: v.license_plate,
//         entryTime: v.entry_time,
//         exitTime: v.exit_time,
//         cost: v.cost,
//         bookingId: v.booking_id
//     })));
//   } catch (error) {
//     console.error('Error fetching vehicle sessions:', error);
//     res.status(500).json({ message: 'Failed to fetch vehicle sessions.' });
//   }
// });

// // POST Check-In a Drive-Up Vehicle (Updates physical available_slots)
// router.post('/checkin', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
//   const { licensePlate } = req.body;
//   if (!licensePlate || typeof licensePlate !== 'string' || licensePlate.trim() === '') {
//     return res.status(400).json({ message: 'License plate is required.' });
//   }
//   const cleanLicensePlate = licensePlate.toUpperCase().trim();

//   // TRANSACTION START (Example comment, implement with your DB library)
//   try {
//     const [currentLocationState] = await dbQuery('SELECT available_slots FROM parking_locations WHERE id = ? FOR UPDATE', [req.employeeLocationId]);
//     if (!currentLocationState || currentLocationState.available_slots <= 0) {
//       // TRANSACTION ROLLBACK
//       return res.status(400).json({ message: 'No available parking slots for drive-up.' });
//     }

//     const [activeSession] = await dbQuery(
//         'SELECT id FROM vehicle_sessions WHERE license_plate = ? AND parking_location_id = ? AND exit_time IS NULL',
//         [cleanLicensePlate, req.employeeLocationId]
//     );
//     if (activeSession) {
//         // TRANSACTION ROLLBACK
//         return res.status(400).json({ message: `Vehicle ${cleanLicensePlate} is already actively parked at this location.`})
//     }

//     const entryTime = new Date();
//     const result = await dbQuery(
//       'INSERT INTO vehicle_sessions (parking_location_id, license_plate, entry_time, employee_id_check_in) VALUES (?, ?, ?, ?)',
//       [req.employeeLocationId, cleanLicensePlate, entryTime, req.user.id]
//     );

//     await dbQuery('UPDATE parking_locations SET available_slots = available_slots - 1 WHERE id = ?', [req.employeeLocationId]);
    
//     // TRANSACTION COMMIT
//     res.status(201).json({ 
//         message: 'Vehicle checked in successfully.', 
//         vehicleSessionId: result.insertId,
//     });
//   } catch (error) {
//     // TRANSACTION ROLLBACK
//     console.error('Error checking in drive-up vehicle:', error);
//     res.status(500).json({ message: 'Failed to check in vehicle.' });
//   }
// });

// // POST Check-Out a Drive-Up Vehicle (Updates physical available_slots)
// router.post('/checkout', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
//   const { vehicleId } = req.body;
//   if (!vehicleId || isNaN(parseInt(vehicleId))) {
//     return res.status(400).json({ message: 'Valid Vehicle ID is required.' });
//   }
//   const numericVehicleId = parseInt(vehicleId, 10);

//   // TRANSACTION START
//   try {
//     const [rateSetting] = await dbQuery("SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1");
//     const hourlyRate = parseFloat(rateSetting?.hourly_rate || "0");

//     const [session] = await dbQuery(
//         'SELECT id, parking_location_id, entry_time, exit_time, booking_id FROM vehicle_sessions WHERE id = ? AND parking_location_id = ? FOR UPDATE', 
//         [numericVehicleId, req.employeeLocationId]
//     );

//     if (!session) return res.status(404).json({ message: 'Vehicle session not found.' });
//     if (session.exit_time) return res.status(400).json({ message: 'Vehicle already checked out.' });

//     const exitTime = new Date();
//     const entryTime = new Date(session.entry_time);
//     const durationMs = exitTime.getTime() - entryTime.getTime();
//     // Example: Min 15 mins (0.25 hours), or actual duration if longer.
//     const durationHours = Math.max(0.25, durationMs / (1000 * 60 * 60)); 
    
//     let cost = 0;
//     if (hourlyRate > 0) {
//         cost = durationHours * hourlyRate;
//         cost = Math.ceil(cost * 100) / 100; 
//     }

//     await dbQuery(
//       'UPDATE vehicle_sessions SET exit_time = ?, cost = ?, employee_id_check_out = ? WHERE id = ?',
//       [exitTime, cost, req.user.id, numericVehicleId]
//     );

//     // If this session was linked to a booking, update the booking status to 'completed'
//     if (session.booking_id) {
//         await dbQuery(
//             "UPDATE bookings SET status = 'completed', actual_exit_time = ? WHERE id = ? AND status = 'checked-in'", // ensure not already completed/cancelled
//             [exitTime, session.booking_id]
//         );
//         // Note: available_slots for bookings are managed by the 70% rule, not incremented here.
//     }
    
//     // Increment physical available_slots for the parking location
//     await dbQuery('UPDATE parking_locations SET available_slots = LEAST(total_slots, available_slots + 1) WHERE id = ?', [session.parking_location_id]);
    
//     // TRANSACTION COMMIT
//     res.json({ message: 'Vehicle checked out successfully.', cost });
//   } catch (error) {
//     // TRANSACTION ROLLBACK
//     console.error('Error checking out vehicle:', error);
//     res.status(500).json({ message: 'Failed to check out vehicle.' });
//   }
// });

// // GET User Bookings for Employee's Location (e.g., for today and tomorrow)
// router.get('/location-bookings', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
//   try {
//     const today = dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss');
//     const dayAfterTomorrowStart = dayjs().add(2, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');

//     const bookings = await dbQuery(
//       `SELECT 
//             b.id as bookingId, b.user_id as userId, u.name as userName, u.email as userEmail, 
//             b.start_time as startTime, b.end_time as endTime, b.status, 
//             b.license_plate_booked as licensePlateBooked,
//             b.checked_in_license_plate as checkedInLicensePlate,
//             b.actual_entry_time as actualEntryTime
//        FROM bookings b
//        JOIN users u ON b.user_id = u.id
//        WHERE b.parking_location_id = ? 
//          AND b.status IN ('confirmed', 'checked-in')
//          AND b.start_time < ?  -- Bookings that start before end of tomorrow
//          AND b.end_time > ?    -- Bookings that end after start of today (overlap with today/tomorrow)
//        ORDER BY b.start_time ASC`,
//       [req.employeeLocationId, dayAfterTomorrowStart, today]
//     );
    
//     res.json(bookings.map(b => ({
//         bookingId: b.bookingId,
//         userId: b.userId,
//         userName: b.userName || b.userEmail,
//         startTime: b.startTime,
//         endTime: b.endTime,
//         status: b.status,
//         licensePlateBooked: b.licensePlateBooked,
//         checkedInLicensePlate: b.checkedInLicensePlate,
//         // actualEntryTime: b.actualEntryTime // You can send this if needed on frontend
//     })));
//   } catch (error) {
//     console.error('Error fetching location bookings:', error);
//     res.status(500).json({ message: 'Failed to fetch location bookings.' });
//   }
// });

// // POST Check-In a Pre-Booked User by Employee (Does NOT change physical available_slots)
// router.post('/bookings/:bookingId/checkin', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
//   const { bookingId } = req.params;
//   const { licensePlate } = req.body;

//   if (!bookingId || isNaN(parseInt(bookingId))) return res.status(400).json({ message: 'Valid Booking ID required.' });
//   if (!licensePlate || typeof licensePlate !== 'string' || licensePlate.trim() === '') {
//     return res.status(400).json({ message: 'License plate required for check-in.' });
//   }
//   const numericBookingId = parseInt(bookingId, 10);
//   const cleanLicensePlate = licensePlate.toUpperCase().trim();

//   // TRANSACTION START
//   try {
//     const [booking] = await dbQuery(
//       'SELECT id, parking_location_id, status, start_time, user_id FROM bookings WHERE id = ? FOR UPDATE', 
//       [numericBookingId]
//     );

//     if (!booking) return res.status(404).json({ message: 'Booking not found.' });
//     if (booking.parking_location_id !== req.employeeLocationId) {
//       return res.status(403).json({ message: 'Booking not for your assigned location.' });
//     }
//     if (booking.status !== 'confirmed') {
//       return res.status(400).json({ message: `Booking already ${booking.status}. Cannot check-in again.` });
//     }

//     const actualEntryTime = new Date();
//     await dbQuery(
//       "UPDATE bookings SET status = 'checked-in', checked_in_license_plate = ?, actual_entry_time = ?, employee_id_check_in = ? WHERE id = ?",
//       [cleanLicensePlate, actualEntryTime, req.user.id, numericBookingId]
//     );
    
//     // Create a corresponding vehicle_session record for tracking physical presence
//     // This helps unify how "currently parked" vehicles are queried, regardless of booking or drive-up
//     await dbQuery(
//       'INSERT INTO vehicle_sessions (parking_location_id, license_plate, entry_time, employee_id_check_in, booking_id) VALUES (?, ?, ?, ?, ?)',
//       [req.employeeLocationId, cleanLicensePlate, actualEntryTime, req.user.id, numericBookingId]
//     );
//     // Note: parking_locations.available_slots is NOT changed here, as per new business rules.

//     // TRANSACTION COMMIT
//     res.json({ message: `Booking ${numericBookingId} checked in successfully.` });
//   } catch (error) {
//     // TRANSACTION ROLLBACK
//     console.error(`Error checking in booking ${bookingId}:`, error);
//     res.status(500).json({ message: 'Failed to check in for booking.' });
//   }
// });

// // NEW: POST to Cancel a User's Booking by Employee (Does NOT change physical available_slots)
// router.post('/bookings/:bookingId/cancel-by-employee', verifyToken(['employee']), checkEmployeeAndLoadLocation, async (req, res) => {
//     const { bookingId } = req.params;
//     if (!bookingId || isNaN(parseInt(bookingId))) {
//         return res.status(400).json({ message: 'Valid Booking ID is required.' });
//     }
//     const numericBookingId = parseInt(bookingId, 10);

//     // TRANSACTION START
//     try {
//         const [booking] = await dbQuery(
//             'SELECT id, parking_location_id, status FROM bookings WHERE id = ? FOR UPDATE',
//             [numericBookingId]
//         );

//         if (!booking) return res.status(404).json({ message: 'Booking not found.' });
//         if (booking.parking_location_id !== req.employeeLocationId) {
//             return res.status(403).json({ message: 'This booking is not for your assigned location.' });
//         }
//         if (booking.status === 'cancelled' || booking.status === 'completed') {
//             return res.status(400).json({ message: `Booking is already ${booking.status} and cannot be cancelled by employee.` });
//         }

//         // Update booking status to 'cancelled'
//         await dbQuery(
//             "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
//             [numericBookingId]
//         );

//         // If the booking was 'checked-in', its corresponding vehicle_session should ideally be checked out.
//         // For simplicity here, we are just cancelling the booking record.
//         // A more complex flow might force a checkout of an associated vehicle_session.
//         // If a vehicle_session was created for this booking upon check-in, and now employee cancels,
//         // that vehicle_session might become an orphaned "parked" record if not handled.
//         // For now, this route only changes booking status. The car, if checked-in via booking, would still need
//         // to be checked out via the drive-up checkout mechanism using its vehicle_session ID.
//         // Or, this cancel could also try to find and void/checkout the linked vehicle_session.

//         // TRANSACTION COMMIT
//         res.json({ message: `Booking ID ${numericBookingId} cancelled by employee successfully.` });
//     } catch (error) {
//         // TRANSACTION ROLLBACK
//         console.error(`Error cancelling booking ${bookingId} by employee:`, error);
//         res.status(500).json({ message: 'Failed to cancel booking.' });
//     }
// });


// export default router;