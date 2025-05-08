// server/routes/admin.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../config/database.js'; // Assuming 'query' is the named export
import upload from '../middleware/upload.js';
import fs from 'fs/promises'; 
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// === PARKING LOCATION ROUTES ===
// Add new parking location with cover image
router.post('/parking-location', upload.single('coverImage'), async (req, res) => {
    console.log('\n>>> Reached POST /api/admin/parking-location handler');
    try {
        const { name, latitude: latitudeStr, longitude: longitudeStr, totalSlots: totalSlotsStr } = req.body;
        const coverImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        if (!name || name.trim() === '' || !latitudeStr || !longitudeStr || !totalSlotsStr) {
            return res.status(400).json({ message: 'Name, latitude, longitude, and total slots are required.' });
        }
        const latitude = parseFloat(latitudeStr);
        const longitude = parseFloat(longitudeStr);
        const totalSlots = parseInt(totalSlotsStr, 10);

        if (isNaN(latitude) || isNaN(longitude) || isNaN(totalSlots)) {
            return res.status(400).json({ message: 'Latitude, longitude, and total slots must be valid numbers.' });
        }
        if (totalSlots <= 0) {
            return res.status(400).json({ message: 'Total slots must be a positive number.' });
        }

        const result = await query(
            'INSERT INTO parking_locations (name, latitude, longitude, total_slots, available_slots, cover_image_url) VALUES (?, ?, ?, ?, ?, ?)',
            [name, latitude, longitude, totalSlots, totalSlots, coverImageUrl]
        );
        res.status(201).json({
            id: result.insertId, name, latitude, longitude, totalSlots, availableSlots: totalSlots, coverImageUrl
        });
    } catch (error) {
        console.error('Error adding parking location:', error);
        if (req.file) {
            try { await fs.unlink(req.file.path); } catch (e) { console.error("Error deleting uploaded file during error handling:", e); }
        }
        res.status(500).json({ message: 'Error adding parking location. Please check server logs.' });
    }
});

// Get all parking locations (for admin management) -- CORRECTED
router.get('/locations', async (req, res) => {
    console.log('\n>>> Reached GET /api/admin/locations handler');
    try {
        const dbLocations = await query(`
            SELECT pl.id, pl.name, pl.latitude, pl.longitude, pl.total_slots, 
                   pl.available_slots, pl.cover_image_url,
                   IFNULL(AVG(f.rating), 0) as average_rating,
                   COUNT(DISTINCT f.id) as feedback_count
            FROM parking_locations pl LEFT JOIN feedback f ON pl.id = f.parking_location_id
            GROUP BY pl.id ORDER BY pl.name ASC`);
        const formattedLocations = dbLocations.map(loc => {
            const numAvgRating = parseFloat(loc.average_rating);
            const calculatedAverageRating = isNaN(numAvgRating) ? 0.0 : parseFloat(numAvgRating.toFixed(1));
            return {
                id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude,
                totalSlots: parseInt(loc.total_slots, 10), availableSlots: parseInt(loc.available_slots, 10),
                coverImageUrl: loc.cover_image_url, 
                averageRating: calculatedAverageRating,
                feedbackCount: parseInt(loc.feedback_count, 10)
            };
        });
        res.json(formattedLocations);
    } catch (error) {
        console.error('Error getting parking locations:', error);
        res.status(500).json({ message: 'Error getting parking locations' });
    }
});

// PUT update an existing parking location
router.put('/parking-location/:locationId', upload.single('coverImage'), async (req, res) => {
    const { locationId } = req.params;
    const { name, latitude: latitudeStr, longitude: longitudeStr, totalSlots: totalSlotsStr } = req.body;
    let newCoverImageDbPath = null; 

    console.log(`\n>>> Reached PUT /api/admin/parking-location/${locationId} handler. Body:`, req.body, "File:", req.file);

    if (!name || name.trim() === '' || !latitudeStr || !longitudeStr || !totalSlotsStr) {
        return res.status(400).json({ message: 'Name, latitude, longitude, and total slots are required.' });
    }
    const latitude = parseFloat(latitudeStr);
    const longitude = parseFloat(longitudeStr);
    const totalSlots = parseInt(totalSlotsStr, 10);

    if (isNaN(latitude) || isNaN(longitude) || isNaN(totalSlots)) {
        return res.status(400).json({ message: 'Latitude, longitude, and total slots must be valid numbers.' });
    }
    if (totalSlots <= 0) {
        return res.status(400).json({ message: 'Total slots must be a positive number.' });
    }

    try {
        const [existingLocation] = await query('SELECT cover_image_url, total_slots, available_slots FROM parking_locations WHERE id = ?', [locationId]);
        if (!existingLocation) {
            if (req.file) {
                try { await fs.unlink(req.file.path); } catch (delErr) { console.error("Error deleting orphaned uploaded file:", delErr); }
            }
            return res.status(404).json({ message: 'Parking location not found.' });
        }

        let oldCoverImageServerPath = existingLocation.cover_image_url;
        newCoverImageDbPath = oldCoverImageServerPath; 

        if (req.file) {
            newCoverImageDbPath = `/uploads/${req.file.filename}`;
            if (oldCoverImageServerPath) {
                const fullOldPath = path.join(__dirname, '..', oldCoverImageServerPath); 
                try {
                    await fs.access(fullOldPath); 
                    await fs.unlink(fullOldPath);
                    console.log(`Deleted old cover image: ${fullOldPath}`);
                } catch (err) {
                    if (err.code !== 'ENOENT') { 
                        console.error(`Error deleting old cover image ${fullOldPath}:`, err);
                    }
                }
            }
        }

        const currentOccupiedSlots = existingLocation.total_slots - existingLocation.available_slots;
        let newAvailableSlots = totalSlots - currentOccupiedSlots;
        if (newAvailableSlots < 0) newAvailableSlots = 0;
        if (newAvailableSlots > totalSlots) newAvailableSlots = totalSlots;

        const updateResult = await query(
            'UPDATE parking_locations SET name = ?, latitude = ?, longitude = ?, total_slots = ?, available_slots = ?, cover_image_url = ? WHERE id = ?',
            [name, latitude, longitude, totalSlots, newAvailableSlots, newCoverImageDbPath, locationId]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Parking location not found or no changes applied.' });
        }
        res.json({ 
            message: 'Parking location updated successfully',
            updatedLocation: { id: parseInt(locationId, 10), name, latitude, longitude, totalSlots, availableSlots: newAvailableSlots, coverImageUrl: newCoverImageDbPath }
        });
    } catch (err) {
        console.error(`Error updating parking location ${locationId}:`, err);
        if (req.file) {
             try { await fs.unlink(req.file.path); console.log("Rolled back uploaded file due to error:", req.file.path); } 
             catch (delErr) { console.error("Error deleting new uploaded file during error rollback:", delErr); }
        }
        res.status(500).json({ message: 'Failed to update parking location' });
    }
});

// DELETE a parking location
router.delete('/parking-location/:locationId', async (req, res) => {
    const { locationId } = req.params;
    console.log(`\n>>> Reached DELETE /api/admin/parking-location/${locationId} handler`);
    try {
        const [location] = await query('SELECT cover_image_url FROM parking_locations WHERE id = ?', [locationId]);
        if (!location) {
            return res.status(404).json({ message: 'Parking location not found.' });
        }
        const deleteResult = await query('DELETE FROM parking_locations WHERE id = ?', [locationId]);
        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ message: 'Parking location not found or already deleted.' });
        }
        if (location.cover_image_url) {
            const imageFileSystemPath = path.join(__dirname, '..', location.cover_image_url);
            try {
                await fs.access(imageFileSystemPath);
                await fs.unlink(imageFileSystemPath);
                console.log(`Deleted cover image: ${imageFileSystemPath}`);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                     console.error(`Error deleting cover image ${imageFileSystemPath} for location ${locationId}:`, err);
                }
            }
        }
        res.json({ message: 'Parking location deleted successfully' });
    } catch (err) {
        console.error(`Error deleting parking location ${locationId}:`, err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') { 
            return res.status(400).json({ message: 'Cannot delete location. It is referenced by other records (e.g., bookings, employees).' });
        }
        res.status(500).json({ message: 'Failed to delete parking location' });
    }
});

// === EMPLOYEE MANAGEMENT ROUTES ===
// Add new employee
router.post('/employee', async (req, res) => {
    console.log('\n>>> Reached POST /api/admin/employee handler');
    try {
        const { name, email, password, parkingLocationId } = req.body;
        if (!name || !email || !password || !parkingLocationId) {
            return res.status(400).json({ message: 'All fields are required (name, email, password, parkingLocationId)' });
        }
        const [existingUser] = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const numericParkingLocationId = parkingLocationId ? parseInt(parkingLocationId, 10) : null;
        if (parkingLocationId && isNaN(numericParkingLocationId)) { 
            return res.status(400).json({ message: 'Invalid Parking Location ID.' });
        }
        const result = await query(
            'INSERT INTO users (name, email, password, role, parking_location_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, 'employee', numericParkingLocationId] 
        );
        res.status(201).json({
            id: result.insertId, name, email, role: 'employee', parkingLocationId: numericParkingLocationId
        });
    } catch (error) {
        console.error('Error adding employee:', error);
        res.status(500).json({ message: 'Error adding employee' });
    }
});

// Get all employees
router.get('/employees', async (req, res) => {
    console.log('\n>>> Reached GET /api/admin/employees handler');
    try {
        const dbEmployees = await query(`
            SELECT u.id, u.name, u.email, u.parking_location_id, pl.name as location_name
            FROM users u LEFT JOIN parking_locations pl ON u.parking_location_id = pl.id
            WHERE u.role = 'employee' ORDER BY u.name ASC`);
        const formattedEmployees = dbEmployees.map(emp => ({
            id: emp.id, name: emp.name, email: emp.email,
            parkingLocationId: emp.parking_location_id, locationName: emp.location_name 
        }));
        res.json(formattedEmployees);
    } catch (error) {
        console.error('Error getting employees:', error);
        res.status(500).json({ message: 'Error getting employees' });
    }
});

// PUT update an existing employee
router.put('/employee/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    const { name, email, parkingLocationId } = req.body;
    console.log(`\n>>> Reached PUT /api/admin/employee/${employeeId} handler. Data:`, req.body);

    if (!name || !email || parkingLocationId === undefined || parkingLocationId === null || parkingLocationId === '') {
        return res.status(400).json({ message: 'Name, email, and parkingLocationId are required.' });
    }
    const numericParkingLocationId = parseInt(parkingLocationId, 10);
    if (isNaN(numericParkingLocationId)) {
        return res.status(400).json({ message: 'Parking Location ID must be a valid number.' });
    }

    try {
        const [userToUpdate] = await query('SELECT email FROM users WHERE id = ? AND role = ?', [employeeId, 'employee']);
        if (!userToUpdate) {
            return res.status(404).json({ message: 'Employee not found.' });
        }
        if (userToUpdate.email !== email) {
            const [existingEmailUser] = await query('SELECT id FROM users WHERE email = ? AND id != ?', [email, employeeId]);
            if (existingEmailUser) {
                return res.status(400).json({ message: 'New email address is already in use by another account.' });
            }
        }
        const result = await query(
            'UPDATE users SET name = ?, email = ?, parking_location_id = ? WHERE id = ? AND role = ?',
            [name, email, numericParkingLocationId, employeeId, 'employee']
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Employee not found or no changes made.' });
        }
        res.json({ message: 'Employee updated successfully' });
    } catch (err) {
        console.error(`Error updating employee ${employeeId}:`, err);
        res.status(500).json({ message: 'Failed to update employee' });
    }
});

// DELETE an employee
router.delete('/employee/:employeeId', async (req, res) => {
    const { employeeId } = req.params;
    console.log(`\n>>> Reached DELETE /api/admin/employee/${employeeId} handler`);
    try {
        const result = await query('DELETE FROM users WHERE id = ? AND role = ?', [employeeId, 'employee']);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Employee not found or already deleted.' });
        }
        res.json({ message: 'Employee deleted successfully' });
    } catch (err) {
        console.error(`Error deleting employee ${employeeId}:`, err);
        if (err.code === 'ER_ROW_IS_REFERENCED_2') { 
            return res.status(400).json({ message: 'Cannot delete employee. They may have associated records. Consider deactivating instead.' });
        }
        res.status(500).json({ message: 'Failed to delete employee' });
    }
});

// === SETTINGS ROUTES ===
// Set global hourly rate
router.post('/rate', async (req, res) => {
    console.log('\n>>> Reached POST /api/admin/rate handler');
    try {
        const { hourlyRate } = req.body;
        const numericHourlyRate = parseFloat(hourlyRate);
        if (isNaN(numericHourlyRate) || numericHourlyRate < 0) {
            return res.status(400).json({ message: 'Invalid hourly rate provided. Must be a non-negative number.' });
        }
        const [existingSettings] = await query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
        if (existingSettings) {
            await query('UPDATE settings SET hourly_rate = ? WHERE id = 1', [numericHourlyRate]);
        } else {
            await query('INSERT INTO settings (id, hourly_rate) VALUES (1, ?)', [numericHourlyRate]);
        }
        res.json({ hourlyRate: numericHourlyRate });
    } catch (error) {
        console.error('Error setting hourly rate:', error);
        res.status(500).json({ message: 'Error setting hourly rate' });
    }
});

// Get current hourly rate
router.get('/current-rate', async (req, res) => {
    console.log('\n>>> Reached GET /api/admin/current-rate handler');
    try {
        const [settings] = await query('SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1');
        if (settings && settings.hourly_rate !== null && settings.hourly_rate !== undefined) {
            res.json({ hourlyRate: parseFloat(settings.hourly_rate) });
        } else {
            console.warn('Hourly rate setting not found or is null in database, defaulting to 0.');
            res.json({ hourlyRate: 0 }); 
        }
    } catch (error) {
        console.error('Error fetching current rate:', error);
        res.status(500).json({ message: 'Error fetching current rate' });
    }
});

// === DASHBOARD & ACTIVITY ROUTES ===
// Get dashboard statistics
router.get('/dashboard-stats', async (req, res) => {
    console.log('\n>>> Reached GET /api/admin/dashboard-stats handler');
    try {
        const [locationsCountResult] = await query('SELECT COUNT(*) as count FROM parking_locations');
        const totalLocations = locationsCountResult ? parseInt(locationsCountResult.count, 10) : 0;
        const [employeesCountResult] = await query("SELECT COUNT(*) as count FROM users WHERE role = 'employee'");
        const totalEmployees = employeesCountResult ? parseInt(employeesCountResult.count, 10) : 0;
        const [activeBookingsResult] = await query("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed' OR status = 'checked-in'");
        const totalBookings = activeBookingsResult ? parseInt(activeBookingsResult.count, 10) : 0;
        const [avgRatingResult] = await query('SELECT AVG(rating) as averageRating FROM feedback');
        let averageRatingValue = avgRatingResult && avgRatingResult.averageRating !== null ? parseFloat(avgRatingResult.averageRating) : 0;
        
        const [settingsResult] = await query('SELECT hourly_rate as hourlyRate FROM settings WHERE id = 1 LIMIT 1');
        const hourlyRate = settingsResult && settingsResult.hourlyRate !== null ? parseFloat(settingsResult.hourlyRate) : 0;
        res.json({
            totalLocations, totalEmployees, totalBookings, 
            averageRating: parseFloat(averageRatingValue.toFixed(1)),
            hourlyRate
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
});

// Get recent activity -- CORRECTED
router.get('/recent-activity', async (req, res) => {
    console.log('\n>>> Reached GET /api/admin/recent-activity handler');
    try {
        const limit = 5; 
        // Use b.start_time instead of b.created_at if created_at doesn't exist on bookings table
        const recentBookingsDb = await query(`
            SELECT b.id, b.start_time as timestamp, pl.name as locationName, u.name as userName, b.status
            FROM bookings b 
            JOIN parking_locations pl ON b.parking_location_id = pl.id
            JOIN users u ON b.user_id = u.id 
            ORDER BY b.start_time DESC LIMIT ?`, [limit]);
        
        // Assuming feedback table has created_at and it's correct
        const recentFeedbacksDb = await query(`
            SELECT f.id, f.created_at as timestamp, pl.name as locationName, u.name as userName, f.rating
            FROM feedback f 
            JOIN parking_locations pl ON f.parking_location_id = pl.id
            JOIN users u ON f.user_id = u.id 
            ORDER BY f.created_at DESC LIMIT ?`, [limit]);
        
        // Assuming users table has created_at and it's correct
        const recentUserRegistrationsDb = await query(`
            SELECT id, name as userName, created_at as timestamp, role 
            FROM users
            ORDER BY created_at DESC LIMIT ?`, [limit]);

        const activities = [];
        recentBookingsDb.forEach(b => {
            activities.push({
                id: `booking-${b.id}`, type: 'booking', 
                description: `Booking by ${b.userName || 'User'} for ${b.locationName} (Status: ${b.status}).`,
                timestamp: b.timestamp, // This will now be b.start_time
            });
        });
        recentFeedbacksDb.forEach(f => {
            activities.push({
                id: `feedback-${f.id}`, type: 'feedback', 
                description: `Feedback (Rating: ${f.rating}/5) by ${f.userName || 'User'} for ${f.locationName}.`,
                timestamp: f.timestamp,
            });
        });
        recentUserRegistrationsDb.forEach(u => {
            activities.push({
                id: `user-${u.id}`, type: 'newUser',
                description: `${u.role === 'employee' ? 'Employee' : 'User'} registration: ${u.userName}.`,
                timestamp: u.timestamp,
            });
        });
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const limitedActivities = activities.slice(0, limit);
        res.json(limitedActivities);
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({ message: 'Error fetching recent activity' });
    }
});

// === FEEDBACK ROUTE ===
// Get all feedback (admin view)
router.get('/feedbacks', async (req, res) => {
    console.log('\n>>> Reached GET /api/admin/feedbacks handler');
    try {
        const dbFeedbacks = await query(`
            SELECT f.id, f.rating, f.message, f.created_at, u.name as user_name,
                   pl.name as location_name, pl.id as location_id
            FROM feedback f JOIN users u ON f.user_id = u.id
            JOIN parking_locations pl ON f.parking_location_id = pl.id
            ORDER BY f.created_at DESC`);
        const formattedFeedbacks = dbFeedbacks.map(fb => ({
            id: fb.id, rating: fb.rating, message: fb.message, createdAt: fb.created_at,
            userName: fb.user_name, locationName: fb.location_name, locationId: fb.location_id
        }));
        res.json(formattedFeedbacks);
    } catch (error) {
        console.error('Error getting feedbacks:', error);
        res.status(500).json({ message: 'Error getting feedbacks' });
    }
});

// === ADMIN BOOKING VIEW ROUTE (Corrected for b.created_at) ===
router.get('/bookings', async (req, res) => {
    console.log('\n>>> Reached GET /api/admin/bookings handler');
    const sqlQuery = `
        SELECT 
            b.id, 
            b.start_time, 
            b.end_time, 
            b.status, 
            b.license_plate_booked,
            b.checked_in_license_plate,
            b.actual_entry_time,
            /* b.created_at, -- This column does not exist in your bookings table */
            u.name as userName, 
            u.email as userEmail,
            pl.name as locationName,
            e_check_in.name as checkedInByEmployeeName
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        JOIN parking_locations pl ON b.parking_location_id = pl.id
        LEFT JOIN users e_check_in ON b.employee_id_check_in = e_check_in.id 
        ORDER BY b.start_time DESC`;
    
    console.log('Executing SQL for /api/admin/bookings:', sqlQuery.replace(/\s\s+/g, ' ').trim());

    try {
        const allBookings = await query(sqlQuery);
        
        if (!Array.isArray(allBookings)) {
            console.error('CRITICAL: Data from DB query is not an array for /api/admin/bookings. Received:', allBookings);
            return res.status(500).json({ message: 'Unexpected data format from database while fetching bookings.' });
        }

        const formattedBookings = allBookings.map(b => ({
            ...b, 
            startTime: b.start_time, 
            endTime: b.end_time,
            actualEntryTime: b.actual_entry_time,
            // createdAt will be undefined from DB, frontend will show N/A
        }));
        
        res.json(formattedBookings);
    } catch (error) { 
        console.error('!!! ERROR fetching all bookings for admin (/api/admin/bookings):', error); 
        console.error('SQL Query that potentially failed:', sqlQuery.replace(/\s\s+/g, ' ').trim());
        res.status(500).json({ message: 'Failed to fetch bookings due to a server error.' });
    }
});

export default router;

// // server/routes/admin.js
// import express from 'express';
// import bcrypt from 'bcryptjs';
// import { query } from '../config/database.js'; // Assuming 'query' is the named export from your db config
// import upload from '../middleware/upload.js';
// import fs from 'fs/promises'; // For file system operations like deleting files
// import path from 'path';
// import { fileURLToPath } from 'url';

// // Helper to get __dirname in ES Modules
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const router = express.Router();

// // Add new parking location with cover image
// router.post('/parking-location', upload.single('coverImage'), async (req, res) => {
//     console.log('\n>>> Reached POST /api/admin/parking-location handler');
//     try {
//         const { name, latitude: latitudeStr, longitude: longitudeStr, totalSlots: totalSlotsStr } = req.body;
//         const coverImageUrl = req.file ? `/uploads/${req.file.filename}` : null;

//         if (!name || name.trim() === '' || !latitudeStr || !longitudeStr || !totalSlotsStr) {
//             return res.status(400).json({ message: 'Name, latitude, longitude, and total slots are required.' });
//         }
//         const latitude = parseFloat(latitudeStr);
//         const longitude = parseFloat(longitudeStr);
//         const totalSlots = parseInt(totalSlotsStr, 10);

//         if (isNaN(latitude) || isNaN(longitude) || isNaN(totalSlots)) {
//             return res.status(400).json({ message: 'Latitude, longitude, and total slots must be valid numbers.' });
//         }
//         if (totalSlots <= 0) {
//             return res.status(400).json({ message: 'Total slots must be a positive number.' });
//         }

//         const result = await query(
//             'INSERT INTO parking_locations (name, latitude, longitude, total_slots, available_slots, cover_image_url) VALUES (?, ?, ?, ?, ?, ?)',
//             [name, latitude, longitude, totalSlots, totalSlots, coverImageUrl]
//         );
//         res.status(201).json({
//             id: result.insertId, name, latitude, longitude, totalSlots, availableSlots: totalSlots, coverImageUrl
//         });
//     } catch (error) {
//         console.error('Error adding parking location:', error);
//         // If a file was uploaded but an error occurred, try to delete the uploaded file
//         if (req.file) {
//             try { await fs.unlink(req.file.path); } catch (e) { console.error("Error deleting uploaded file during error handling:", e); }
//         }
//         res.status(500).json({ message: 'Error adding parking location. Please check server logs.' });
//     }
// });

// // --- NEW ROUTES FOR EDIT AND DELETE PARKING LOCATION (INTEGRATED) ---
// // PUT update an existing parking location
// router.put('/parking-location/:locationId', upload.single('coverImage'), async (req, res) => {
//     const { locationId } = req.params;
//     const { name, latitude: latitudeStr, longitude: longitudeStr, totalSlots: totalSlotsStr } = req.body;
//     let newCoverImageDbPath = null; 

//     console.log(`\n>>> Reached PUT /api/admin/parking-location/${locationId} handler. Body:`, req.body, "File:", req.file);

//     if (!name || name.trim() === '' || !latitudeStr || !longitudeStr || !totalSlotsStr) {
//         return res.status(400).json({ message: 'Name, latitude, longitude, and total slots are required.' });
//     }
//     const latitude = parseFloat(latitudeStr);
//     const longitude = parseFloat(longitudeStr);
//     const totalSlots = parseInt(totalSlotsStr, 10);

//     if (isNaN(latitude) || isNaN(longitude) || isNaN(totalSlots)) {
//         return res.status(400).json({ message: 'Latitude, longitude, and total slots must be valid numbers.' });
//     }
//     if (totalSlots <= 0) {
//         return res.status(400).json({ message: 'Total slots must be a positive number.' });
//     }

//     try {
//         const [existingLocation] = await query('SELECT cover_image_url, total_slots, available_slots FROM parking_locations WHERE id = ?', [locationId]);
//         if (!existingLocation) {
//             if (req.file) { // If a new file was uploaded but location not found
//                 try { await fs.unlink(req.file.path); } catch (delErr) { console.error("Error deleting orphaned uploaded file:", delErr); }
//             }
//             return res.status(404).json({ message: 'Parking location not found.' });
//         }

//         let oldCoverImageServerPath = existingLocation.cover_image_url;
//         newCoverImageDbPath = oldCoverImageServerPath; // Assume old image path initially

//         if (req.file) {
//             newCoverImageDbPath = `/uploads/${req.file.filename}`;
//             if (oldCoverImageServerPath) {
//                 // Construct full path to old image. Assumes 'uploads' is in 'server/' and this file is in 'server/routes/'
//                 const fullOldPath = path.join(__dirname, '..', oldCoverImageServerPath); 
//                 try {
//                     await fs.access(fullOldPath); 
//                     await fs.unlink(fullOldPath);
//                     console.log(`Deleted old cover image: ${fullOldPath}`);
//                 } catch (err) {
//                     if (err.code !== 'ENOENT') { 
//                         console.error(`Error deleting old cover image ${fullOldPath}:`, err);
//                     }
//                 }
//             }
//         }

//         const currentOccupiedSlots = existingLocation.total_slots - existingLocation.available_slots;
//         let newAvailableSlots = totalSlots - currentOccupiedSlots;
//         if (newAvailableSlots < 0) newAvailableSlots = 0;
//         if (newAvailableSlots > totalSlots) newAvailableSlots = totalSlots;

//         const updateResult = await query(
//             'UPDATE parking_locations SET name = ?, latitude = ?, longitude = ?, total_slots = ?, available_slots = ?, cover_image_url = ? WHERE id = ?',
//             [name, latitude, longitude, totalSlots, newAvailableSlots, newCoverImageDbPath, locationId]
//         );

//         if (updateResult.affectedRows === 0) {
//             return res.status(404).json({ message: 'Parking location not found or no changes applied.' });
//         }
//         res.json({ 
//             message: 'Parking location updated successfully',
//             updatedLocation: { id: parseInt(locationId, 10), name, latitude, longitude, totalSlots, availableSlots: newAvailableSlots, coverImageUrl: newCoverImageDbPath }
//         });
//     } catch (err) {
//         console.error(`Error updating parking location ${locationId}:`, err);
//         if (req.file) { // If an error occurs after a new file was uploaded
//              try { await fs.unlink(req.file.path); console.log("Rolled back uploaded file due to error:", req.file.path); } 
//              catch (delErr) { console.error("Error deleting new uploaded file during error rollback:", delErr); }
//         }
//         res.status(500).json({ message: 'Failed to update parking location' });
//     }
// });

// // DELETE a parking location
// router.delete('/parking-location/:locationId', async (req, res) => {
//     const { locationId } = req.params;
//     console.log(`\n>>> Reached DELETE /api/admin/parking-location/${locationId} handler`);

//     try {
//         const [location] = await query('SELECT cover_image_url FROM parking_locations WHERE id = ?', [locationId]);
//         if (!location) {
//             return res.status(404).json({ message: 'Parking location not found.' });
//         }

//         const deleteResult = await query('DELETE FROM parking_locations WHERE id = ?', [locationId]);
//         if (deleteResult.affectedRows === 0) {
//             return res.status(404).json({ message: 'Parking location not found or already deleted.' });
//         }

//         if (location.cover_image_url) {
//             const imageFileSystemPath = path.join(__dirname, '..', location.cover_image_url);
//             try {
//                 await fs.access(imageFileSystemPath);
//                 await fs.unlink(imageFileSystemPath);
//                 console.log(`Deleted cover image: ${imageFileSystemPath}`);
//             } catch (err) {
//                 if (err.code !== 'ENOENT') {
//                      console.error(`Error deleting cover image ${imageFileSystemPath} for location ${locationId}:`, err);
//                 }
//             }
//         }
//         res.json({ message: 'Parking location deleted successfully' });
//     } catch (err) {
//         console.error(`Error deleting parking location ${locationId}:`, err);
//         if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') { 
//             return res.status(400).json({ message: 'Cannot delete location. It is referenced by other records (e.g., bookings, employees).' });
//         }
//         res.status(500).json({ message: 'Failed to delete parking location' });
//     }
// });
// // --- END OF EDIT AND DELETE PARKING LOCATION ROUTES ---


// // Add new employee
// router.post('/employee', async (req, res) => {
//     console.log('\n>>> Reached POST /api/admin/employee handler');
//     try {
//         const { name, email, password, parkingLocationId } = req.body;
//         if (!name || !email || !password || !parkingLocationId) {
//             return res.status(400).json({ message: 'All fields are required (name, email, password, parkingLocationId)' });
//         }
//         const [existingUser] = await query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
//         if (existingUser) {
//             return res.status(400).json({ message: 'User already exists with this email' });
//         }
//         const salt = await bcrypt.genSalt(10);
//         const hashedPassword = await bcrypt.hash(password, salt);
//         const numericParkingLocationId = parseInt(parkingLocationId, 10);
//         if (isNaN(numericParkingLocationId)) {
//             return res.status(400).json({ message: 'Invalid Parking Location ID.' });
//         }
//         const result = await query(
//             'INSERT INTO users (name, email, password, role, parking_location_id) VALUES (?, ?, ?, ?, ?)',
//             [name, email, hashedPassword, 'employee', numericParkingLocationId]
//         );
//         res.status(201).json({
//             id: result.insertId, name, email, role: 'employee', parkingLocationId: numericParkingLocationId
//         });
//     } catch (error) {
//         console.error('Error adding employee:', error);
//         res.status(500).json({ message: 'Error adding employee' });
//     }
// });

// // Get all employees
// router.get('/employees', async (req, res) => {
//     console.log('\n>>> Reached GET /api/admin/employees handler');
//     try {
//         const dbEmployees = await query(`
//             SELECT u.id, u.name, u.email, u.parking_location_id, pl.name as location_name
//             FROM users u LEFT JOIN parking_locations pl ON u.parking_location_id = pl.id
//             WHERE u.role = 'employee' ORDER BY u.name ASC`);
//         const formattedEmployees = dbEmployees.map(emp => ({
//             id: emp.id, name: emp.name, email: emp.email,
//             parkingLocationId: emp.parking_location_id, locationName: emp.location_name 
//         }));
//         res.json(formattedEmployees);
//     } catch (error) {
//         console.error('Error getting employees:', error);
//         res.status(500).json({ message: 'Error getting employees' });
//     }
// });

// // PUT update an existing employee
// router.put('/employee/:employeeId', async (req, res) => {
//     const { employeeId } = req.params;
//     const { name, email, parkingLocationId } = req.body;
//     console.log(`\n>>> Reached PUT /api/admin/employee/${employeeId} handler. Data:`, req.body);

//     if (!name || !email || parkingLocationId === undefined || parkingLocationId === null || parkingLocationId === '') {
//         return res.status(400).json({ message: 'Name, email, and parkingLocationId are required.' });
//     }
//     const numericParkingLocationId = parseInt(parkingLocationId, 10);
//     if (isNaN(numericParkingLocationId)) {
//         return res.status(400).json({ message: 'Parking Location ID must be a valid number.' });
//     }

//     try {
//         const [userToUpdate] = await query('SELECT email FROM users WHERE id = ? AND role = ?', [employeeId, 'employee']);
//         if (!userToUpdate) {
//             return res.status(404).json({ message: 'Employee not found.' });
//         }
//         if (userToUpdate.email !== email) {
//             const [existingEmailUser] = await query('SELECT id FROM users WHERE email = ? AND id != ?', [email, employeeId]);
//             if (existingEmailUser) {
//                 return res.status(400).json({ message: 'New email address is already in use by another account.' });
//             }
//         }
//         const result = await query(
//             'UPDATE users SET name = ?, email = ?, parking_location_id = ? WHERE id = ? AND role = ?',
//             [name, email, numericParkingLocationId, employeeId, 'employee']
//         );
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Employee not found or no changes made.' });
//         }
//         res.json({ message: 'Employee updated successfully' });
//     } catch (err) {
//         console.error(`Error updating employee ${employeeId}:`, err);
//         res.status(500).json({ message: 'Failed to update employee' });
//     }
// });

// // DELETE an employee
// router.delete('/employee/:employeeId', async (req, res) => {
//     const { employeeId } = req.params;
//     console.log(`\n>>> Reached DELETE /api/admin/employee/${employeeId} handler`);
//     try {
//         const result = await query('DELETE FROM users WHERE id = ? AND role = ?', [employeeId, 'employee']);
//         if (result.affectedRows === 0) {
//             return res.status(404).json({ message: 'Employee not found or already deleted.' });
//         }
//         res.json({ message: 'Employee deleted successfully' });
//     } catch (err) {
//         console.error(`Error deleting employee ${employeeId}:`, err);
//         if (err.code === 'ER_ROW_IS_REFERENCED_2') { 
//             return res.status(400).json({ message: 'Cannot delete employee. They may have associated records. Consider deactivating instead.' });
//         }
//         res.status(500).json({ message: 'Failed to delete employee' });
//     }
// });

// // Set global hourly rate
// router.post('/rate', async (req, res) => {
//     console.log('\n>>> Reached POST /api/admin/rate handler');
//     try {
//         const { hourlyRate } = req.body;
//         const numericHourlyRate = parseFloat(hourlyRate);
//         if (isNaN(numericHourlyRate) || numericHourlyRate < 0) {
//             return res.status(400).json({ message: 'Invalid hourly rate provided. Must be a non-negative number.' });
//         }
//         const [existingSettings] = await query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
//         if (existingSettings) {
//             await query('UPDATE settings SET hourly_rate = ? WHERE id = 1', [numericHourlyRate]);
//         } else {
//             await query('INSERT INTO settings (id, hourly_rate) VALUES (1, ?)', [numericHourlyRate]);
//         }
//         res.json({ hourlyRate: numericHourlyRate });
//     } catch (error) {
//         console.error('Error setting hourly rate:', error);
//         res.status(500).json({ message: 'Error setting hourly rate' });
//     }
// });

// // Get all parking locations (for admin management)
// router.get('/locations', async (req, res) => {
//     console.log('\n>>> Reached GET /api/admin/locations handler');
//     try {
//         const dbLocations = await query(`
//             SELECT pl.id, pl.name, pl.latitude, pl.longitude, pl.total_slots, 
//                    pl.available_slots, pl.cover_image_url,
//                    IFNULL(AVG(f.rating), 0) as average_rating,
//                    COUNT(DISTINCT f.id) as feedback_count
//             FROM parking_locations pl LEFT JOIN feedback f ON pl.id = f.parking_location_id
//             GROUP BY pl.id ORDER BY pl.name ASC`);
//         const formattedLocations = dbLocations.map(loc => ({
//             id: loc.id, name: loc.name, latitude: loc.latitude, longitude: loc.longitude,
//             totalSlots: parseInt(loc.total_slots, 10), availableSlots: parseInt(loc.available_slots, 10),
//             coverImageUrl: loc.cover_image_url, averageRating: parseFloat(loc.average_rating),
//             feedbackCount: parseInt(loc.feedback_count, 10)
//         }));
//         res.json(formattedLocations);
//     } catch (error) {
//         console.error('Error getting parking locations:', error);
//         res.status(500).json({ message: 'Error getting parking locations' });
//     }
// });

// // Get dashboard statistics
// router.get('/dashboard-stats', async (req, res) => {
//     console.log('\n>>> Reached GET /api/admin/dashboard-stats handler');
//     try {
//         const [locationsCountResult] = await query('SELECT COUNT(*) as count FROM parking_locations');
//         const totalLocations = locationsCountResult ? parseInt(locationsCountResult.count, 10) : 0;
//         const [employeesCountResult] = await query("SELECT COUNT(*) as count FROM users WHERE role = 'employee'");
//         const totalEmployees = employeesCountResult ? parseInt(employeesCountResult.count, 10) : 0;
//         const [activeBookingsResult] = await query("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed' OR status = 'checked-in'");
//         const totalBookings = activeBookingsResult ? parseInt(activeBookingsResult.count, 10) : 0;
//         const [avgRatingResult] = await query('SELECT AVG(rating) as averageRating FROM feedback');
//         const averageRating = avgRatingResult && avgRatingResult.averageRating !== null ? parseFloat(avgRatingResult.averageRating) : 0;
//         const [settingsResult] = await query('SELECT hourly_rate as hourlyRate FROM settings WHERE id = 1 LIMIT 1');
//         const hourlyRate = settingsResult && settingsResult.hourlyRate !== null ? parseFloat(settingsResult.hourlyRate) : 0;
//         res.json({
//             totalLocations, totalEmployees, totalBookings, 
//             averageRating: parseFloat(averageRating.toFixed(1)), hourlyRate
//         });
//     } catch (error) {
//         console.error('Error fetching dashboard stats:', error);
//         res.status(500).json({ message: 'Error fetching dashboard stats' });
//     }
// });

// // Get recent activity
// router.get('/recent-activity', async (req, res) => {
//     console.log('\n>>> Reached GET /api/admin/recent-activity handler');
//     try {
//         const limit = 5; 
//         const recentBookingsDb = await query(`
//             SELECT b.id, b.created_at as timestamp, pl.name as locationName, u.name as userName, b.status
//             FROM bookings b JOIN parking_locations pl ON b.parking_location_id = pl.id
//             JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC LIMIT ?`, [limit]);
//         const recentFeedbacksDb = await query(`
//             SELECT f.id, f.created_at as timestamp, pl.name as locationName, u.name as userName, f.rating
//             FROM feedback f JOIN parking_locations pl ON f.parking_location_id = pl.id
//             JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC LIMIT ?`, [limit]);
//         const recentUserRegistrationsDb = await query(`
//             SELECT id, name as userName, created_at as timestamp, role FROM users
//             ORDER BY created_at DESC LIMIT ?`, [limit]);
//         const activities = [];
//         recentBookingsDb.forEach(b => {
//             activities.push({
//                 id: `booking-${b.id}`, type: 'booking', 
//                 description: `Booking by ${b.userName || 'User'} for ${b.locationName} (Status: ${b.status}).`,
//                 timestamp: b.timestamp,
//             });
//         });
//         recentFeedbacksDb.forEach(f => {
//             activities.push({
//                 id: `feedback-${f.id}`, type: 'feedback', 
//                 description: `Feedback (Rating: ${f.rating}/5) by ${f.userName || 'User'} for ${f.locationName}.`,
//                 timestamp: f.timestamp,
//             });
//         });
//         recentUserRegistrationsDb.forEach(u => {
//             activities.push({
//                 id: `user-${u.id}`, type: 'newUser',
//                 description: `${u.role === 'employee' ? 'Employee' : 'User'} registration: ${u.userName}.`,
//                 timestamp: u.timestamp,
//             });
//         });
//         activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
//         const limitedActivities = activities.slice(0, limit);
//         res.json(limitedActivities);
//     } catch (error) {
//         console.error('Error fetching recent activity:', error);
//         res.status(500).json({ message: 'Error fetching recent activity' });
//     }
// });

// // Get current hourly rate
// router.get('/current-rate', async (req, res) => {
//     console.log('\n>>> Reached GET /api/admin/current-rate handler');
//     try {
//         const [settings] = await query('SELECT hourly_rate FROM settings WHERE id = 1 LIMIT 1');
//         if (settings && settings.hourly_rate !== null && settings.hourly_rate !== undefined) {
//             res.json({ hourlyRate: parseFloat(settings.hourly_rate) });
//         } else {
//             console.warn('Hourly rate setting not found or is null in database, defaulting to 0.');
//             res.json({ hourlyRate: 0 }); 
//         }
//     } catch (error) {
//         console.error('Error fetching current rate:', error);
//         res.status(500).json({ message: 'Error fetching current rate' });
//     }
// });

// // Get all feedback with ratings (admin view)
// router.get('/feedbacks', async (req, res) => {
//     console.log('\n>>> Reached GET /api/admin/feedbacks handler');
//     try {
//         const dbFeedbacks = await query(`
//             SELECT f.id, f.rating, f.message, f.created_at, u.name as user_name,
//                    pl.name as location_name, pl.id as location_id
//             FROM feedback f JOIN users u ON f.user_id = u.id
//             JOIN parking_locations pl ON f.parking_location_id = pl.id
//             ORDER BY f.created_at DESC`);
//         const formattedFeedbacks = dbFeedbacks.map(fb => ({
//             id: fb.id, rating: fb.rating, message: fb.message, createdAt: fb.created_at,
//             userName: fb.user_name, locationName: fb.location_name, locationId: fb.location_id
//         }));
//         res.json(formattedFeedbacks);
//     } catch (error) {
//         console.error('Error getting feedbacks:', error);
//         res.status(500).json({ message: 'Error getting feedbacks' });
//     }
// });

// export default router;