// server/routes/general.js
import express from 'express';
import { query as dbQuery } from '../config/database.js';
import { verifyToken } from '../middleware/auth.js';
import dayjs from 'dayjs'; 

const router = express.Router();

router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} (general.js)`);
  next();
});

// GET all parking locations (Public)
router.get('/locations', async (req, res) => {
  try {
    const locations = await dbQuery(
      `SELECT id, name, latitude, longitude, total_slots, available_slots, cover_image_url, 
              (SELECT AVG(rating) FROM feedback WHERE parking_location_id = parking_locations.id) as averageRating,
              (SELECT COUNT(*) FROM feedback WHERE parking_location_id = parking_locations.id) as feedbackCount
       FROM parking_locations`
    );
    res.json(locations.map(loc => ({
      id: loc.id,
      name: loc.name,
      latitude: loc.latitude,
      longitude: loc.longitude,
      totalSlots: loc.total_slots,
      availableSlots: loc.available_slots,
      coverImageUrl: loc.cover_image_url,
      averageRating: parseFloat(loc.averageRating) || 0,
      feedbackCount: parseInt(loc.feedbackCount) || 0,
    })));
  } catch (err) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ message: 'Failed to fetch locations' });
  }
});

// POST a new booking by a logged-in user
router.post('/locations/bookings', verifyToken(['user', 'admin', 'employee']), async (req, res) => {
  console.log('\n>>> Reached POST /api/locations/bookings. User ID:', req.user?.id); 
  const { parkingLocationId, startTime: startTimeISO, endTime: endTimeISO, licensePlateBooked } = req.body;
  
  if (!req.user || !req.user.id) {
    return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
  }
  const userId = req.user.id;

  if (!parkingLocationId || !startTimeISO || !endTimeISO) {
    return res.status(400).json({ message: 'Missing required booking information.' });
  }
  
  const STime = dayjs(startTimeISO);
  const ETime = dayjs(endTimeISO);

  if (!STime.isValid() || !ETime.isValid() || ETime.isBefore(STime) || STime.isBefore(dayjs())) {
    return res.status(400).json({ message: 'Invalid booking time range or start time is in the past.' });
  }
  
  const formattedStartTime = STime.format('YYYY-MM-DD HH:mm:ss');
  const formattedEndTime = ETime.format('YYYY-MM-DD HH:mm:ss');

  try {
    const [location] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ? FOR UPDATE', [parkingLocationId]);
    if (!location) {
      return res.status(404).json({ message: 'Parking location not found.' });
    }

    const bookingThresholdPercent = 0.70; 
    const bookingCapacity = Math.floor(location.total_slots * bookingThresholdPercent);

    const [overlappingBookingsResult] = await dbQuery(
      `SELECT COUNT(*) as count FROM bookings 
       WHERE parking_location_id = ? AND status IN ('confirmed', 'checked-in')
       AND start_time < ? AND end_time > ?`, 
      [parkingLocationId, formattedEndTime, formattedStartTime]
    );
    const currentOverlappingBookings = overlappingBookingsResult.count || 0;

    if (currentOverlappingBookings >= bookingCapacity) {
      return res.status(400).json({ message: 'Booking capacity reached. Please try another time or location.' });
    }

    const result = await dbQuery(
      'INSERT INTO bookings (user_id, parking_location_id, start_time, end_time, status, license_plate_booked) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, parkingLocationId, formattedStartTime, formattedEndTime, 'confirmed', licensePlateBooked || null]
    );
    
    res.status(201).json({ 
      message: 'Booking successful!', 
      bookingId: result.insertId,
      parkingLocationId, 
      startTime: startTimeISO, 
      endTime: endTimeISO,  
      status: 'confirmed', 
      licensePlateBooked
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Failed to create booking.' });
  }
});

// GET user's bookings (authenticated) - UPDATED TO INCLUDE actual_entry_time
router.get('/locations/bookings', verifyToken(['user', 'admin', 'employee']), async (req, res) => {
  console.log('\n>>> GET /api/locations/bookings. User ID:', req.user?.id);
  
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const bookingsFromDb = await dbQuery(
      `SELECT 
        b.id, 
        b.start_time, 
        b.end_time, 
        b.status,
        b.license_plate_booked,
        b.actual_entry_time,     -- Added
        b.actual_exit_time,      
        b.final_cost,            
        p.name as locationName,
        p.id as locationId
       FROM bookings b
       JOIN parking_locations p ON b.parking_location_id = p.id
       WHERE b.user_id = ?
       ORDER BY b.start_time DESC`,
      [req.user.id]
    );

    const formattedBookings = bookingsFromDb.map(booking => ({
      id: booking.id,
      startTime: booking.start_time, 
      endTime: booking.end_time,   
      locationName: booking.locationName,
      locationId: booking.locationId,
      status: booking.status,
      licensePlateBooked: booking.license_plate_booked,
      actualEntryTime: booking.actual_entry_time, // Added camelCase for entry time
      actualExitTime: booking.actual_exit_time, 
      finalCost: booking.final_cost,
    }));

    res.json(formattedBookings);
  } catch (err) {
    console.error('Error fetching user bookings:', err);
    res.status(500).json({ message: 'Failed to fetch your bookings' });
  }
});

// PATCH to cancel a booking (User can cancel their own booking)
router.patch('/locations/bookings/:bookingId/cancel', verifyToken(['user']), async (req, res) => {
  console.log('\n>>> PATCH /api/locations/bookings/:bookingId/cancel. User ID:', req.user?.id);
  const { bookingId } = req.params;
  
  if (!req.user || !req.user.id) {
    return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
  }
  const userId = req.user.id;

  try {
    const [booking] = await dbQuery(
      'SELECT id, user_id, status, start_time FROM bookings WHERE id = ? FOR UPDATE', 
      [bookingId]
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    if (booking.user_id !== userId) {
      return res.status(403).json({ message: 'You can only cancel your own bookings.' });
    }
    
    const STime = dayjs(booking.start_time);
    if (booking.status !== 'confirmed' || STime.isBefore(dayjs().add(1, 'hour'))) { 
        let message = `Booking cannot be cancelled.`;
        if (booking.status !== 'confirmed') {
            message += ` Its current status is: ${booking.status}.`;
        } else {
            message += ` It is too close to the start time or already past.`;
        }
        return res.status(400).json({ message });
    }

    await dbQuery("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);
    
    res.json({ message: 'Booking cancelled successfully.' });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
});

// GET a specific parking location by ID (Public)
router.get('/locations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const [location] = await dbQuery(
        `SELECT id, name, latitude, longitude, total_slots, available_slots, cover_image_url,
                (SELECT AVG(rating) FROM feedback WHERE parking_location_id = parking_locations.id) as averageRating,
                (SELECT COUNT(*) FROM feedback WHERE parking_location_id = parking_locations.id) as feedbackCount
         FROM parking_locations WHERE id = ?`,
        [locationId]
    );
    if (!location) {
      return res.status(404).json({ message: 'Location not found' });
    }
    res.json({
      id: location.id,
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      totalSlots: location.total_slots,
      availableSlots: location.available_slots,
      coverImageUrl: location.cover_image_url,
      averageRating: parseFloat(location.averageRating) || 0,
      feedbackCount: parseInt(location.feedbackCount) || 0,
    });
  } catch (err) {
    console.error('Error fetching location by ID:', err);
    res.status(500).json({ message: 'Failed to fetch location details' });
  }
});

// GET Booking Availability
router.get('/locations/:locationId/booking-availability', async (req, res) => {
    const { locationId } = req.params;
    const startTimeQuery = req.query.startTime; 
    const endTimeQuery = req.query.endTime;

    if (!startTimeQuery || !endTimeQuery) {
        return res.status(400).json({ message: "Start time and end time are required." });
    }
    
    const STime = dayjs(startTimeQuery); 
    const ETime = dayjs(endTimeQuery);

    if (!STime.isValid() || !ETime.isValid() || ETime.isBefore(STime)) {
        return res.status(400).json({ message: "Invalid date/time format or range." });
    }

    try {
        const [location] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ?', [locationId]);
        if (!location) {
            return res.status(404).json({ message: "Parking location not found." });
        }

        const bookingThresholdPercent = 0.70; 
        const bookingCapacity = Math.floor(location.total_slots * bookingThresholdPercent);

        const [overlappingBookingsResult] = await dbQuery(
            `SELECT COUNT(*) as count 
             FROM bookings 
             WHERE parking_location_id = ? 
               AND status IN ('confirmed', 'checked-in')
               AND start_time < ? 
               AND end_time > ?`,
            [locationId, ETime.format('YYYY-MM-DD HH:mm:ss'), STime.format('YYYY-MM-DD HH:mm:ss')] 
        );
        const currentOverlappingBookings = overlappingBookingsResult.count || 0;

        const canBook = currentOverlappingBookings < bookingCapacity;
        const availableForBooking = Math.max(0, bookingCapacity - currentOverlappingBookings);

        res.json({ 
            isBookable: canBook, 
            message: canBook ? `${availableForBooking} booking slot(s) available.` : "Booking capacity reached.",
            slotsAvailableForBooking: availableForBooking,
            bookingCapacityForLocation: bookingCapacity,
            currentBookedCountInSlot: currentOverlappingBookings
        });

    } catch (error) {
        console.error("Error checking booking availability:", error);
        res.status(500).json({ message: "Failed to check booking availability." });
    }
});

// POST feedback for a location (User role)
router.post('/locations/feedback', verifyToken(['user']), async (req, res) => {
  console.log('\n>>> POST /api/locations/feedback. User ID:', req.user?.id);
  const { parkingLocationId, rating, message } = req.body;
  
  if (!req.user || !req.user.id) {
    return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
  }
  const userId = req.user.id;

  if (!parkingLocationId || rating === undefined) {
    return res.status(400).json({ message: 'Parking location and rating are required.' });
  }
  const numericRating = Number(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ message: 'Rating must be a number between 1 and 5.' });
  }

  try {
    await dbQuery(
      'INSERT INTO feedback (user_id, parking_location_id, rating, message) VALUES (?, ?, ?, ?)',
      [userId, parkingLocationId, numericRating, message || null]
    );
    res.status(201).json({ message: 'Feedback submitted successfully!' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: 'Failed to submit feedback.' });
  }
});

// GET feedback for a specific location (Public)
router.get('/locations/:locationId/feedback', async (req, res) => {
    const { locationId } = req.params;
    try {
        const feedbackList = await dbQuery(
            `SELECT f.id, f.rating, f.message, f.created_at, u.name as user_name 
             FROM feedback f
             JOIN users u ON f.user_id = u.id
             WHERE f.parking_location_id = ? 
             ORDER BY f.created_at DESC`,
            [locationId]
        );
        res.json(feedbackList.map(f => ({
            ...f,
        })));
    } catch (error) {
        console.error('Error fetching feedback for location:', error);
        res.status(500).json({ message: 'Failed to fetch feedback.' });
    }
});

// GET Hourly Parking Rate
router.get('/settings/rate', async (req, res) => {
  try {
    const [rateSetting] = await dbQuery("SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1"); 
    
    if (!rateSetting || rateSetting.hourly_rate === null || isNaN(parseFloat(rateSetting.hourly_rate))) {
      console.warn('Hourly rate not configured/invalid in DB. API defaulting to 0.');
      return res.json({ hourlyRate: 0 });
    }
    res.json({ hourlyRate: parseFloat(rateSetting.hourly_rate) });
  } catch (error) {
    console.error('Error fetching hourly rate:', error);
    res.status(500).json({ message: 'Failed to fetch hourly rate.' });
  }
});

export default router;










// // server/routes/general.js
// import express from 'express';
// import { query as dbQuery } from '../config/database.js';
// import { verifyToken } from '../middleware/auth.js';
// import dayjs from 'dayjs'; 

// const router = express.Router();

// router.use((req, res, next) => {
//   console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
//   next();
// });
// // Add this to general.js temporarily
// router.get('/locations/test', (req, res) => {
//   res.json({ success: true, message: "Test route is working" });
// });
// // GET all parking locations (Public)
// router.get('/locations', async (req, res) => {
//   try {
//     const locations = await dbQuery(
//       `SELECT id, name, latitude, longitude, total_slots, available_slots, cover_image_url, 
//               (SELECT AVG(rating) FROM feedback WHERE parking_location_id = parking_locations.id) as averageRating,
//               (SELECT COUNT(*) FROM feedback WHERE parking_location_id = parking_locations.id) as feedbackCount
//        FROM parking_locations`
//     );
//     res.json(locations.map(loc => ({
//         id: loc.id,
//         name: loc.name,
//         latitude: loc.latitude,
//         longitude: loc.longitude,
//         totalSlots: loc.total_slots,
//         availableSlots: loc.available_slots,
//         coverImageUrl: loc.cover_image_url,
//         averageRating: parseFloat(loc.averageRating) || 0,
//         feedbackCount: parseInt(loc.feedbackCount) || 0,
//     })));
//   } catch (err) {
//     console.error('Error fetching locations:', err);
//     res.status(500).json({ message: 'Failed to fetch locations' });
//   }
// });


// // POST a new booking by a logged-in user
// router.post('/locations/bookings', verifyToken(['user', 'admin', 'employee']), async (req, res) => {
//   console.log('\n>>> Reached POST /api/locations/bookings handler. User ID:', req.user?.id, 'Role:', req.user?.role); 
//   const { parkingLocationId, startTime: startTimeISO, endTime: endTimeISO, licensePlateBooked } = req.body;
  
//   if (!req.user || !req.user.id) {
//       console.error('CRITICAL: User not found in POST /locations/bookings after verifyToken. This should not happen.');
//       return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
//   }
//   const userId = req.user.id;

//   if (!parkingLocationId || !startTimeISO || !endTimeISO) {
//     return res.status(400).json({ message: 'Missing required booking information.' });
//   }
  
//   const STime = dayjs(startTimeISO);
//   const ETime = dayjs(endTimeISO);

//   if (!STime.isValid() || !ETime.isValid() || ETime.isBefore(STime) || STime.isBefore(dayjs())) {
//     return res.status(400).json({ message: 'Invalid booking time range or start time is in the past.' });
//   }
  
//   const formattedStartTime = STime.format('YYYY-MM-DD HH:mm:ss');
//   const formattedEndTime = ETime.format('YYYY-MM-DD HH:mm:ss');

//   try {
//     const [location] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ? FOR UPDATE', [parkingLocationId]);
//     if (!location) {
//       return res.status(404).json({ message: 'Parking location not found.' });
//     }

//     const bookingThresholdPercent = 0.70; 
//     const bookingCapacity = Math.floor(location.total_slots * bookingThresholdPercent);

//     const [overlappingBookingsResult] = await dbQuery(
//       `SELECT COUNT(*) as count FROM bookings 
//        WHERE parking_location_id = ? AND status IN ('confirmed', 'checked-in')
//        AND start_time < ? AND end_time > ?`, 
//       [parkingLocationId, endTimeISO, startTimeISO] 
//     );
//     const currentOverlappingBookings = overlappingBookingsResult.count || 0;

//     if (currentOverlappingBookings >= bookingCapacity) {
//       return res.status(400).json({ message: 'Booking capacity reached for this time slot. Please try another time or location.' });
//     }

//     const result = await dbQuery(
//       'INSERT INTO bookings (user_id, parking_location_id, start_time, end_time, status, license_plate_booked) VALUES (?, ?, ?, ?, ?, ?)',
//       [userId, parkingLocationId, formattedStartTime, formattedEndTime, 'confirmed', licensePlateBooked || null]
//     );
    
//     res.status(201).json({ 
//         message: 'Booking successful!', 
//         bookingId: result.insertId,
//         parkingLocationId, 
//         startTime: startTimeISO, 
//         endTime: endTimeISO,   
//         status: 'confirmed', 
//         licensePlateBooked
//     });
//   } catch (error) {
//     console.error('Error creating booking:', error);
//     res.status(500).json({ message: 'Failed to create booking.' });
//   }
// });

// // GET user's bookings (authenticated)
// router.get('/locations/bookings', verifyToken(['user', 'admin', 'employee']), async (req, res) => {
//   console.log('\n>>> GET /api/locations/bookings handler. User ID:', req.user?.id);
  
//   if (!req.user || !req.user.id) {
//     return res.status(401).json({ message: 'Authentication required' });
//   }

//   try {
//     const bookings = await dbQuery(
//       `SELECT 
//         b.id, 
//         b.start_time as startTime, 
//         b.end_time as endTime, 
//         b.status,
//         b.license_plate_booked as licensePlate,
//         p.name as locationName,
//         p.id as locationId
//        FROM bookings b
//        JOIN parking_locations p ON b.parking_location_id = p.id
//        WHERE b.user_id = ?
//        ORDER BY b.start_time DESC`,
//       [req.user.id]
//     );

//     // Format the response to match frontend expectations
//     const formattedBookings = bookings.map(booking => ({
//       id: booking.id,
//       startTime: booking.startTime,
//       endTime: booking.endTime,
//       locationName: booking.locationName,
//       locationId: booking.locationId,
//       status: booking.status,
//       licensePlateBooked: booking.licensePlate
//     }));

//     res.json(formattedBookings);
//   } catch (err) {
//     console.error('Error fetching bookings:', err);
//     res.status(500).json({ message: 'Failed to fetch bookings' });
//   }
// });

// // PATCH to cancel a booking (User can cancel their own booking)
// router.patch('/locations/bookings/:bookingId/cancel', verifyToken(['user']), async (req, res) => {
//   console.log('\n>>> Reached PATCH /api/locations/bookings/:bookingId/cancel handler. User ID:', req.user?.id, 'Role:', req.user?.role);
//   const { bookingId } = req.params;
  
//   if (!req.user || !req.user.id) {
//       console.error('CRITICAL: User not found in PATCH /locations/bookings/:bookingId/cancel after verifyToken.');
//       return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
//   }
//   const userId = req.user.id;

//   try {
//     const [test] = await dbQuery('SELECT 1 as test');
//     console.log('Database test:', test); // Should show { test: 1 }
    
//     const [booking] = await dbQuery(
//       'SELECT id, user_id, parking_location_id, status FROM bookings WHERE id = ? FOR UPDATE', 
//       [bookingId]
//     );

//     if (!booking) {
//       return res.status(404).json({ message: 'Booking not found.' });
//     }
//     if (booking.user_id !== userId) {
//       return res.status(403).json({ message: 'You can only cancel your own bookings.' });
//     }
//     if (booking.status !== 'confirmed') { 
//       return res.status(400).json({ message: `Booking cannot be cancelled. Current status: ${booking.status}` });
//     }

//     await dbQuery("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);
    
//     res.json({ message: 'Booking cancelled successfully.' });
//   } catch (error) {
//     console.error('Error cancelling booking:', error);
//     res.status(500).json({ message: 'Failed to cancel booking.' });
//   }
// });


// // GET a specific parking location by ID (Public)
// router.get('/locations/:locationId', async (req, res) => {
//   try {
//     const { locationId } = req.params;
//     const [location] = await dbQuery(
//         `SELECT id, name, latitude, longitude, total_slots, available_slots, cover_image_url,
//                 (SELECT AVG(rating) FROM feedback WHERE parking_location_id = parking_locations.id) as averageRating,
//                 (SELECT COUNT(*) FROM feedback WHERE parking_location_id = parking_locations.id) as feedbackCount
//          FROM parking_locations WHERE id = ?`,
//         [locationId]
//     );
//     if (!location) {
//       return res.status(404).json({ message: 'Location not found' });
//     }
//     res.json({
//         id: location.id,
//         name: location.name,
//         latitude: location.latitude,
//         longitude: location.longitude,
//         totalSlots: location.total_slots,
//         availableSlots: location.available_slots,
//         coverImageUrl: location.cover_image_url,
//         averageRating: parseFloat(location.averageRating) || 0,
//         feedbackCount: parseInt(location.feedbackCount) || 0,
//     });
//   } catch (err) {
//     console.error('Error fetching location by ID:', err);
//     res.status(500).json({ message: 'Failed to fetch location details' });
//   }
// });

// // GET Booking Availability for a location and time slot (Public or User role)
// router.get('/locations/:locationId/booking-availability', async (req, res) => {
//     const { locationId } = req.params;
//     const startTimeQuery = req.query.startTime; 
//     const endTimeQuery = req.query.endTime;

//     if (!startTimeQuery || !endTimeQuery) {
//         return res.status(400).json({ message: "Start time and end time are required." });
//     }
    
//     const STime = dayjs(startTimeQuery); 
//     const ETime = dayjs(endTimeQuery);

//     if (!STime.isValid() || !ETime.isValid() || ETime.isBefore(STime)) {
//         return res.status(400).json({ message: "Invalid date/time format or range." });
//     }

//     try {
//         const [location] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ?', [locationId]);
//         if (!location) {
//             return res.status(404).json({ message: "Parking location not found." });
//         }

//         const bookingThresholdPercent = 0.70; 
//         const bookingCapacity = Math.floor(location.total_slots * bookingThresholdPercent);

//         const [overlappingBookingsResult] = await dbQuery(
//             `SELECT COUNT(*) as count 
//              FROM bookings 
//              WHERE parking_location_id = ? 
//                AND status IN ('confirmed', 'checked-in')
//                AND start_time < ? 
//                AND end_time > ?`,
//             [locationId, ETime.toISOString(), STime.toISOString()] 
//         );
//         const currentOverlappingBookings = overlappingBookingsResult.count || 0;

//         const canBook = currentOverlappingBookings < bookingCapacity;
//         const availableForBooking = Math.max(0, bookingCapacity - currentOverlappingBookings);

//         res.json({ 
//             isBookable: canBook, 
//             message: canBook ? `${availableForBooking} booking slot(s) available for the selected time.` : "Booking capacity reached for this time slot.",
//             slotsAvailableForBooking: availableForBooking,
//             bookingCapacityForLocation: bookingCapacity,
//             currentBookedCountInSlot: currentOverlappingBookings
//         });

//     } catch (error) {
//         console.error("Error checking booking availability:", error);
//         res.status(500).json({ message: "Failed to check booking availability." });
//     }
// });

// // POST feedback for a location (User role)
// router.post('/locations/feedback', verifyToken(['user']), async (req, res) => {
//   console.log('\n>>> Reached POST /api/locations/feedback handler. User ID:', req.user?.id, 'Role:', req.user?.role);
//   const { parkingLocationId, rating, message } = req.body;
  
//   if (!req.user || !req.user.id) {
//       console.error('CRITICAL: User not found in POST /locations/feedback after verifyToken.');
//       return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
//   }
//   const userId = req.user.id;

//   if (!parkingLocationId || !rating) {
//     return res.status(400).json({ message: 'Parking location and rating are required.' });
//   }
//   if (rating < 1 || rating > 5) {
//     return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
//   }

//   try {
//     await dbQuery(
//       'INSERT INTO feedback (user_id, parking_location_id, rating, message) VALUES (?, ?, ?, ?)',
//       [userId, parkingLocationId, rating, message || null]
//     );
//     res.status(201).json({ message: 'Feedback submitted successfully!' });
//   } catch (error) {
//     console.error('Error submitting feedback:', error);
//     res.status(500).json({ message: 'Failed to submit feedback.' });
//   }
// });

// // GET feedback for a specific location (Public)
// router.get('/locations/:locationId/feedback', async (req, res) => {
//     const { locationId } = req.params;
//     try {
//         const feedbackList = await dbQuery(
//             `SELECT f.id, f.rating, f.message, f.created_at, u.name as user_name 
//              FROM feedback f
//              JOIN users u ON f.user_id = u.id
//              WHERE f.parking_location_id = ? 
//              ORDER BY f.created_at DESC`,
//             [locationId]
//         );
//         res.json(feedbackList.map(f => ({
//             ...f,
//             created_at: dayjs(f.created_at).toISOString(),
//         })));
//     } catch (error) {
//         console.error('Error fetching feedback for location:', error);
//         res.status(500).json({ message: 'Failed to fetch feedback.' });
//     }
// });

// // GET Hourly Parking Rate (Public or semi-public)
// router.get('/settings/rate', async (req, res) => {
//   try {
//     const [rateSetting] = await dbQuery("SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1"); 
    
//     if (!rateSetting || isNaN(parseFloat(rateSetting.hourly_rate))) {
//       console.warn('Hourly rate not configured or invalid. Defaulting to 0.');
//       return res.json({ hourlyRate: 0 });
//     }
//     res.json({ hourlyRate: parseFloat(rateSetting.hourly_rate) });
//   } catch (error) {
//     console.error('Error fetching hourly rate:', error);
//     res.status(500).json({ message: 'Failed to fetch system settings (hourly rate).' });
//   }
// });

// export default router;





// // // server/routes/general.js
// // import express from 'express';
// // import { query as dbQuery } from '../config/database.js';
// // import { verifyToken } from '../middleware/auth.js';
// // import dayjs from 'dayjs'; 

// // const router = express.Router();

// // // GET all parking locations (Public)
// // router.get('/locations', async (req, res) => {
// //   try {
// //     const locations = await dbQuery(
// //       `SELECT id, name, latitude, longitude, total_slots, available_slots, cover_image_url, 
// //               (SELECT AVG(rating) FROM feedback WHERE parking_location_id = parking_locations.id) as averageRating,
// //               (SELECT COUNT(*) FROM feedback WHERE parking_location_id = parking_locations.id) as feedbackCount
// //        FROM parking_locations`
// //     );
// //     res.json(locations.map(loc => ({
// //         id: loc.id,
// //         name: loc.name,
// //         latitude: loc.latitude,
// //         longitude: loc.longitude,
// //         totalSlots: loc.total_slots,
// //         availableSlots: loc.available_slots,
// //         coverImageUrl: loc.cover_image_url,
// //         averageRating: parseFloat(loc.averageRating) || 0,
// //         feedbackCount: parseInt(loc.feedbackCount) || 0,
// //     })));
// //   } catch (err) {
// //     console.error('Error fetching locations:', err);
// //     res.status(500).json({ message: 'Failed to fetch locations' });
// //   }
// // });

// // // GET a specific parking location by ID (Public)
// // router.get('/locations/:locationId', async (req, res) => {
// //   try {
// //     const { locationId } = req.params;
// //     const [location] = await dbQuery(
// //         `SELECT id, name, latitude, longitude, total_slots, available_slots, cover_image_url,
// //                 (SELECT AVG(rating) FROM feedback WHERE parking_location_id = parking_locations.id) as averageRating,
// //                 (SELECT COUNT(*) FROM feedback WHERE parking_location_id = parking_locations.id) as feedbackCount
// //          FROM parking_locations WHERE id = ?`,
// //         [locationId]
// //     );
// //     if (!location) {
// //       return res.status(404).json({ message: 'Location not found' });
// //     }
// //     res.json({
// //         id: location.id,
// //         name: location.name,
// //         latitude: location.latitude,
// //         longitude: location.longitude,
// //         totalSlots: location.total_slots,
// //         availableSlots: location.available_slots,
// //         coverImageUrl: location.cover_image_url,
// //         averageRating: parseFloat(location.averageRating) || 0,
// //         feedbackCount: parseInt(location.feedbackCount) || 0,
// //     });
// //   } catch (err) {
// //     console.error('Error fetching location by ID:', err);
// //     res.status(500).json({ message: 'Failed to fetch location details' });
// //   }
// // });

// // // GET Booking Availability for a location and time slot (Public or User role)
// // router.get('/locations/:locationId/booking-availability', async (req, res) => {
// //     const { locationId } = req.params;
// //     const startTimeQuery = req.query.startTime; 
// //     const endTimeQuery = req.query.endTime;

// //     if (!startTimeQuery || !endTimeQuery) {
// //         return res.status(400).json({ message: "Start time and end time are required." });
// //     }
    
// //     const STime = dayjs(startTimeQuery); 
// //     const ETime = dayjs(endTimeQuery);

// //     if (!STime.isValid() || !ETime.isValid() || ETime.isBefore(STime)) {
// //         return res.status(400).json({ message: "Invalid date/time format or range." });
// //     }

// //     try {
// //         const [location] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ?', [locationId]);
// //         if (!location) {
// //             return res.status(404).json({ message: "Parking location not found." });
// //         }

// //         const bookingThresholdPercent = 0.70; 
// //         const bookingCapacity = Math.floor(location.total_slots * bookingThresholdPercent);

// //         const [overlappingBookingsResult] = await dbQuery(
// //             `SELECT COUNT(*) as count 
// //              FROM bookings 
// //              WHERE parking_location_id = ? 
// //                AND status IN ('confirmed', 'checked-in')
// //                AND start_time < ? 
// //                AND end_time > ?`,
// //             [locationId, ETime.toISOString(), STime.toISOString()] 
// //         );
// //         const currentOverlappingBookings = overlappingBookingsResult.count || 0;

// //         const canBook = currentOverlappingBookings < bookingCapacity;
// //         const availableForBooking = Math.max(0, bookingCapacity - currentOverlappingBookings);

// //         res.json({ 
// //             isBookable: canBook, 
// //             message: canBook ? `${availableForBooking} booking slot(s) available for the selected time.` : "Booking capacity reached for this time slot.",
// //             slotsAvailableForBooking: availableForBooking,
// //             bookingCapacityForLocation: bookingCapacity,
// //             currentBookedCountInSlot: currentOverlappingBookings
// //         });

// //     } catch (error) {
// //         console.error("Error checking booking availability:", error);
// //         res.status(500).json({ message: "Failed to check booking availability." });
// //     }
// // });


// // // POST a new booking by a logged-in user
// // router.post('/locations/bookings', verifyToken(['user', 'admin', 'employee']), async (req, res) => {
// //   console.log('\n>>> Reached POST /api/locations/bookings handler. User ID:', req.user?.id, 'Role:', req.user?.role); 
// //   const { parkingLocationId, startTime: startTimeISO, endTime: endTimeISO, licensePlateBooked } = req.body;
  
// //   if (!req.user || !req.user.id) {
// //       console.error('CRITICAL: User not found in POST /locations/bookings after verifyToken. This should not happen.');
// //       return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
// //   }
// //   const userId = req.user.id;

// //   if (!parkingLocationId || !startTimeISO || !endTimeISO) {
// //     return res.status(400).json({ message: 'Missing required booking information.' });
// //   }
  
// //   const STime = dayjs(startTimeISO);
// //   const ETime = dayjs(endTimeISO);

// //   if (!STime.isValid() || !ETime.isValid() || ETime.isBefore(STime) || STime.isBefore(dayjs())) {
// //     return res.status(400).json({ message: 'Invalid booking time range or start time is in the past.' });
// //   }
  
// //   const formattedStartTime = STime.format('YYYY-MM-DD HH:mm:ss');
// //   const formattedEndTime = ETime.format('YYYY-MM-DD HH:mm:ss');

// //   try {
// //     const [location] = await dbQuery('SELECT total_slots FROM parking_locations WHERE id = ? FOR UPDATE', [parkingLocationId]);
// //     if (!location) {
// //       return res.status(404).json({ message: 'Parking location not found.' });
// //     }

// //     const bookingThresholdPercent = 0.70; 
// //     const bookingCapacity = Math.floor(location.total_slots * bookingThresholdPercent);

// //     const [overlappingBookingsResult] = await dbQuery(
// //       `SELECT COUNT(*) as count FROM bookings 
// //        WHERE parking_location_id = ? AND status IN ('confirmed', 'checked-in')
// //        AND start_time < ? AND end_time > ?`, 
// //       [parkingLocationId, endTimeISO, startTimeISO] 
// //     );
// //     const currentOverlappingBookings = overlappingBookingsResult.count || 0;

// //     if (currentOverlappingBookings >= bookingCapacity) {
// //       return res.status(400).json({ message: 'Booking capacity reached for this time slot. Please try another time or location.' });
// //     }

// //     const result = await dbQuery(
// //       'INSERT INTO bookings (user_id, parking_location_id, start_time, end_time, status, license_plate_booked) VALUES (?, ?, ?, ?, ?, ?)',
// //       [userId, parkingLocationId, formattedStartTime, formattedEndTime, 'confirmed', licensePlateBooked || null]
// //     );
    
// //     res.status(201).json({ 
// //         message: 'Booking successful!', 
// //         bookingId: result.insertId,
// //         parkingLocationId, 
// //         startTime: startTimeISO, 
// //         endTime: endTimeISO,   
// //         status: 'confirmed', 
// //         licensePlateBooked
// //     });
// //   } catch (error) {
// //     console.error('Error creating booking:', error);
// //     res.status(500).json({ message: 'Failed to create booking.' });
// //   }
// // });

// // // ***** START OF EXTREMELY SIMPLIFIED DEBUGGING VERSION FOR THIS ROUTE *****
// // // GET user's own bookings
// // router.get('/locations/bookings', async (req,res) => { // verifyToken REMOVED for this test
// //   console.log('\n!!!! DEBUG: Reached EXTREMELY SIMPLIFIED GET /locations/bookings handler in general.js (NO verifyToken, NO DB query) !!!!');
// //   try {
// //     // Send a simple array response to match what frontend might expect (though content is dummy)
// //     res.status(200).json([
// //       { 
// //         id: 999, 
// //         locationName: "Debug Location", 
// //         startTime: new Date().toISOString(), 
// //         endTime: new Date().toISOString(), 
// //         status: "debug",
// //         message: "Simplified debug response from GET /locations/bookings in general.js" 
// //       },
// //       { 
// //         id: 998, 
// //         locationName: "Debug Location 2", 
// //         startTime: new Date().toISOString(), 
// //         endTime: new Date().toISOString(), 
// //         status: "debug",
// //         note: "This means the generalRoutes router matched the path." 
// //       }
// //     ]);
// //   } catch (err) {
// //     console.error('Error in EXTREMELY SIMPLIFIED GET /locations/bookings handler:', err);
// //     res.status(500).json({ message: 'Failed in simplified handler' });
// //   }
// // });
// // // ***** END OF EXTREMELY SIMPLIFIED DEBUGGING VERSION *****


// // // PATCH to cancel a booking (User can cancel their own booking)
// // router.patch('/locations/bookings/:bookingId/cancel', verifyToken(['user']), async (req, res) => {
// //   console.log('\n>>> Reached PATCH /api/locations/bookings/:bookingId/cancel handler. User ID:', req.user?.id, 'Role:', req.user?.role);
// //   const { bookingId } = req.params;
  
// //   if (!req.user || !req.user.id) {
// //       console.error('CRITICAL: User not found in PATCH /locations/bookings/:bookingId/cancel after verifyToken.');
// //       return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
// //   }
// //   const userId = req.user.id;

// //   try {
// //     const [booking] = await dbQuery(
// //       'SELECT id, user_id, parking_location_id, status FROM bookings WHERE id = ? FOR UPDATE', 
// //       [bookingId]
// //     );

// //     if (!booking) {
// //       return res.status(404).json({ message: 'Booking not found.' });
// //     }
// //     if (booking.user_id !== userId) {
// //       return res.status(403).json({ message: 'You can only cancel your own bookings.' });
// //     }
// //     if (booking.status !== 'confirmed') { 
// //       return res.status(400).json({ message: `Booking cannot be cancelled. Current status: ${booking.status}` });
// //     }

// //     await dbQuery("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);
    
// //     res.json({ message: 'Booking cancelled successfully.' });
// //   } catch (error) {
// //     console.error('Error cancelling booking:', error);
// //     res.status(500).json({ message: 'Failed to cancel booking.' });
// //   }
// // });


// // // POST feedback for a location (User role)
// // router.post('/locations/feedback', verifyToken(['user']), async (req, res) => {
// //   console.log('\n>>> Reached POST /api/locations/feedback handler. User ID:', req.user?.id, 'Role:', req.user?.role);
// //   const { parkingLocationId, rating, message } = req.body;
  
// //   if (!req.user || !req.user.id) {
// //       console.error('CRITICAL: User not found in POST /locations/feedback after verifyToken.');
// //       return res.status(500).json({ message: 'Authentication error, user identifier missing.' });
// //   }
// //   const userId = req.user.id;

// //   if (!parkingLocationId || !rating) {
// //     return res.status(400).json({ message: 'Parking location and rating are required.' });
// //   }
// //   if (rating < 1 || rating > 5) {
// //     return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
// //   }

// //   try {
// //     await dbQuery(
// //       'INSERT INTO feedback (user_id, parking_location_id, rating, message) VALUES (?, ?, ?, ?)',
// //       [userId, parkingLocationId, rating, message || null]
// //     );
// //     res.status(201).json({ message: 'Feedback submitted successfully!' });
// //   } catch (error) {
// //     console.error('Error submitting feedback:', error);
// //     res.status(500).json({ message: 'Failed to submit feedback.' });
// //   }
// // });

// // // GET feedback for a specific location (Public)
// // router.get('/locations/:locationId/feedback', async (req, res) => {
// //     const { locationId } = req.params;
// //     try {
// //         const feedbackList = await dbQuery(
// //             `SELECT f.id, f.rating, f.message, f.created_at, u.name as user_name 
// //              FROM feedback f
// //              JOIN users u ON f.user_id = u.id
// //              WHERE f.parking_location_id = ? 
// //              ORDER BY f.created_at DESC`,
// //             [locationId]
// //         );
// //         res.json(feedbackList.map(f => ({
// //             ...f,
// //             created_at: dayjs(f.created_at).toISOString(),
// //         })));
// //     } catch (error) {
// //         console.error('Error fetching feedback for location:', error);
// //         res.status(500).json({ message: 'Failed to fetch feedback.' });
// //     }
// // });


// // // GET Hourly Parking Rate (Public or semi-public)
// // router.get('/settings/rate', async (req, res) => {
// //   try {
// //     const [rateSetting] = await dbQuery("SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1"); 
    
// //     if (!rateSetting || isNaN(parseFloat(rateSetting.hourly_rate))) {
// //       console.warn('Hourly rate not configured or invalid. Defaulting to 0.');
// //       return res.json({ hourlyRate: 0 });
// //     }
// //     res.json({ hourlyRate: parseFloat(rateSetting.hourly_rate) });
// //   } catch (error) {
// //     console.error('Error fetching hourly rate:', error);
// //     res.status(500).json({ message: 'Failed to fetch system settings (hourly rate).' });
// //   }
// // });

// // export default router;