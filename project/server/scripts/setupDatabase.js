// setupDatabase.js
import { pool } from '../config/database.js'; // Ensure this path is correct
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs'; // Make sure dayjs is imported for seeding bookings

// Create tables and initialize with seed data
const setupDatabase = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Successfully connected to the database.');

    console.log('Creating database tables...');

    // Parking Locations table (Create first as others depend on it)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS parking_locations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        latitude FLOAT NOT NULL,
        longitude FLOAT NOT NULL,
        total_slots INT NOT NULL,
        available_slots INT NOT NULL,
        cover_image_url VARCHAR(255) NULL
      ) ENGINE=InnoDB;
    `);
    console.log('Table "parking_locations" created.');

    // Users table (Depends on parking_locations for employee assignment)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'employee', 'user') NOT NULL DEFAULT 'user',
        parking_location_id INT NULL, -- For employee assignment
        FOREIGN KEY (parking_location_id) REFERENCES parking_locations(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('Table "users" created.');

    // Settings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY, -- Expecting a single row, e.g., id=1 for global settings
        hourly_rate DECIMAL(5,2) NOT NULL
      ) ENGINE=InnoDB;
    `);
    console.log('Table "settings" created.');

    // Bookings table (Depends on users and parking_locations)
    // await connection.query(`
    //   CREATE TABLE IF NOT EXISTS bookings (
    //     id INT PRIMARY KEY AUTO_INCREMENT,
    //     user_id INT NOT NULL,
    //     parking_location_id INT NOT NULL,
    //     start_time DATETIME NOT NULL,
    //     end_time DATETIME NOT NULL,
    //     status VARCHAR(20) DEFAULT 'confirmed',
    //     license_plate_booked VARCHAR(50) NULL,      -- Optional: License plate provided by user during booking
    //     checked_in_license_plate VARCHAR(50) NULL, -- License plate confirmed/entered by employee at check-in
    //     actual_entry_time DATETIME NULL,            -- Actual time of check-in by employee
    //     employee_id_check_in INT NULL,              -- Employee who handled booking check-in
    //     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    //     FOREIGN KEY (parking_location_id) REFERENCES parking_locations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    //     FOREIGN KEY (employee_id_check_in) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
    //   ) ENGINE=InnoDB;
    // `);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        parking_location_id INT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        status VARCHAR(20) DEFAULT 'confirmed',
        license_plate_booked VARCHAR(50) NULL,      -- Optional: License plate provided by user during booking
        checked_in_license_plate VARCHAR(50) NULL, -- License plate confirmed/entered by employee at check-in
        actual_entry_time DATETIME NULL,            -- Actual time of check-in by employee
        employee_id_check_in INT NULL,              -- Employee who handled booking check-in
        actual_exit_time DATETIME NULL,             -- Actual time of check-out
        final_cost DECIMAL(10,2) NULL,              -- Final cost after check-out
        employee_id_check_out INT NULL,             -- Employee who handled booking check-out
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (parking_location_id) REFERENCES parking_locations(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (employee_id_check_in) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (employee_id_check_out) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE -- New FK
      ) ENGINE=InnoDB;
    `);
    console.log('Table "bookings" created.');
    
    // Vehicle Sessions table (replaces old 'vehicles' table, depends on users, parking_locations, bookings)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS vehicle_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        parking_location_id INT NOT NULL,
        license_plate VARCHAR(50) NOT NULL,
        entry_time DATETIME NOT NULL,
        exit_time DATETIME NULL,
        cost DECIMAL(10,2) NULL,
        employee_id_check_in INT NULL,   -- Employee who handled drive-up check-in or booking check-in
        employee_id_check_out INT NULL,  -- Employee who handled drive-up check-out
        booking_id INT NULL,             -- Optional: Links to the original booking if this session is for a pre-booked user
        FOREIGN KEY (parking_location_id) REFERENCES parking_locations(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (employee_id_check_in) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (employee_id_check_out) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL ON UPDATE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('Table "vehicle_sessions" created.');

    // Feedback table (Depends on users and parking_locations)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        parking_location_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        message TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        FOREIGN KEY (parking_location_id) REFERENCES parking_locations(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB;
    `);
    console.log('Table "feedback" created.');

    console.log('All tables created successfully!');

    // Check if admin user exists to prevent re-seeding identified by admin email
    const [adminRows] = await connection.query('SELECT id FROM users WHERE email = "admin@example.com" LIMIT 1');

    if (adminRows.length === 0) {
      console.log('Creating seed data...');

      // --- Seed Parking Locations FIRST ---
      // const locationsData = [
      //   { name: 'NIE North Campus Parking', latitude: 12.3548, longitude: 76.5848, totalSlots: 30, coverImage: '/uploads/1746547732051-WhatsApp-Image-2025-04-08-at-20.33.11_5ef58e23.jpg' },
      //   { name: 'Downtown Parking Central', latitude: 40.7128, longitude: -74.0060, totalSlots: 100, coverImage: '/uploads/downtown.jpg' },
      //   { name: 'City Mall Parking Deck', latitude: 40.7138, longitude: -74.0070, totalSlots: 200, coverImage: '/uploads/mall.jpg' },
      //   { name: 'Airport Long-Term Parking', latitude: 40.7148, longitude: -74.0080, totalSlots: 500, coverImage: '/uploads/airport.jpg' }
      // ];
      
      // const locationIds = [];
      // for (const loc of locationsData) {
      //   const [result] = await connection.query(
      //     'INSERT INTO parking_locations (name, latitude, longitude, total_slots, available_slots, cover_image_url) VALUES (?, ?, ?, ?, ?, ?)',
      //     [loc.name, loc.latitude, loc.longitude, loc.totalSlots, loc.totalSlots, loc.coverImage]
      //   );
      //   locationIds.push(result.insertId); // Store inserted location IDs
      // }
      // console.log('Sample parking locations seeded.');

      // --- Seed Users ---
      const salt = await bcrypt.genSalt(10);
      const adminPassword = await bcrypt.hash('admin123', salt); // Change default passwords in production!
      await connection.query(
        'INSERT INTO users (name, email, password, role, parking_location_id) VALUES (?, ?, ?, ?, ?)',
        ['Admin ParkMaster', 'admin@example.com', adminPassword, 'admin', null] // Admin not tied to one location
      );
      console.log("Admin created with credential admin@example.com::admin123");

      // const employeePassword = await bcrypt.hash('employee123', salt); // Change default passwords!
      // // Assign employees to the first two seeded locations
      // if (locationIds.length > 0) {
      //   await connection.query(
      //     'INSERT INTO users (name, email, password, role, parking_location_id) VALUES (?, ?, ?, ?, ?)',
      //     ['John Gatekeeper', 'john.employee@example.com', employeePassword, 'employee', locationIds[0]]
      //   );
      // }
      // if (locationIds.length > 1) {
      //   await connection.query(
      //     'INSERT INTO users (name, email, password, role, parking_location_id) VALUES (?, ?, ?, ?, ?)',
      //     ['Jane Valet', 'jane.employee@example.com', employeePassword, 'employee', locationIds[1]]
      //   );
      // }
      //  console.log('Admin and sample employees seeded.');

      // const userPassword = await bcrypt.hash('user123', salt); // Change default passwords!
      // const [aliceResult] = await connection.query(
      //   'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      //   ['Alice Driver', 'alice@example.com', userPassword, 'user']
      // );
      // await connection.query(
      //   'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      //   ['Bob Parker', 'bob@example.com', userPassword, 'user']
      // );
      // console.log('Sample users seeded.');

      // --- Seed Settings ---
      await connection.query('INSERT INTO settings (id, hourly_rate) VALUES (1, 50.00)'); // Example rate: 50 (e.g., INR 50)
      console.log('Default settings seeded.');
      
      // --- Optional: Seed some bookings or vehicle_sessions if needed for initial testing ---
      // Example: Seed a confirmed booking for Alice at the first location for today
      const aliceId = aliceResult.insertId;
      if (aliceId && locationIds.length > 0) {
        const todayStartTime = dayjs().add(1, 'hour').minute(0).second(0).format('YYYY-MM-DD HH:mm:ss'); // Today, next hour
        const todayEndTime = dayjs(todayStartTime).add(2, 'hour').format('YYYY-MM-DD HH:mm:ss');   // 2 hours later
        await connection.query(
          'INSERT INTO bookings (user_id, parking_location_id, start_time, end_time, status, license_plate_booked) VALUES (?, ?, ?, ?, ?, ?)',
          [aliceId, locationIds[0], todayStartTime, todayEndTime, 'confirmed', 'ALICE01']
        );
        // Decrement available slots for the booked location
        await connection.query(
            'UPDATE parking_locations SET available_slots = available_slots - 1 WHERE id = ? AND available_slots > 0',
            [locationIds[0]]
        );
        console.log('Sample booking seeded.');
      }


      console.log('Seed data created successfully!');
    } else {
      console.log('Admin user "admin@example.com" already exists, skipping all seed data creation.');
    }

  } catch (error) {
    console.error('Error setting up database:', error);
    process.exitCode = 1; // Set exit code to indicate failure
  } finally {
    if (connection) {
      try {
        await connection.release();
        console.log('Database connection released.');
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
    // Ensure the pool is closed if your script is meant to exit,
    // or remove this if the script is part of a larger application startup
    try {
        await pool.end();
        console.log('Connection pool closed.');
    } catch (poolEndError) {
        console.error('Error closing connection pool:', poolEndError);
    }
    // process.exit() can truncate async operations like console.log, using process.exitCode is safer
    if (process.exitCode === 1) {
        process.exit(1);
    } else {
        process.exit(0);
    }
  }
};

// Run setup
setupDatabase();


// import { pool } from '../config/database.js';
// import bcrypt from 'bcryptjs';

// // Create tables and initialize with seed data
// const setupDatabase = async () => {
//   try {
//     const connection = await pool.getConnection();
    
//     console.log('Creating database tables...');
    
//     // Users table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS users (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         name VARCHAR(100) NOT NULL,
//         email VARCHAR(100) UNIQUE NOT NULL,
//         password VARCHAR(255) NOT NULL,
//         role ENUM('admin', 'employee', 'user') NOT NULL DEFAULT 'user',
//         parking_location_id INT NULL
//       )
//     `);
    
//     // Parking Locations table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS parking_locations (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         name VARCHAR(100) NOT NULL,
//         latitude FLOAT NOT NULL,
//         longitude FLOAT NOT NULL,
//         total_slots INT NOT NULL,
//         available_slots INT NOT NULL,
//         cover_image_url VARCHAR(255) NULL
//       )
//     `);
    
//     // Vehicles table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS vehicles (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         entry_time DATETIME NOT NULL,
//         exit_time DATETIME NULL,
//         employee_id INT NOT NULL,
//         parking_location_id INT NOT NULL,
//         cost DECIMAL(10,2) NULL
//       )
//     `);
    
//     // Settings table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS settings (
//         id INT PRIMARY KEY,
//         hourly_rate DECIMAL(5,2) NOT NULL
//       )
//     `);
    
//     // Bookings table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS bookings (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         user_id INT NOT NULL,
//         parking_location_id INT NOT NULL,
//         start_time DATETIME NOT NULL,
//         end_time DATETIME NOT NULL,
//         status VARCHAR(20) DEFAULT 'confirmed'
//       )
//     `);
    
//     // Feedback table
//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS feedback (
//         id INT PRIMARY KEY AUTO_INCREMENT,
//         user_id INT NOT NULL,
//         parking_location_id INT NOT NULL,
//         rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
//         message TEXT NULL,
//         created_at DATETIME DEFAULT CURRENT_TIMESTAMP        
//       )
//     `);
    
//     console.log('Tables created successfully!');
    
//     // Check if admin user exists
//     const [adminRows] = await connection.query('SELECT * FROM users WHERE role = "admin" LIMIT 1');
    
//     if (adminRows.length === 0) {
//       console.log('Creating seed data...');
      
//       // Create default admin user
//       const salt = await bcrypt.genSalt(10);
//       const adminPassword = await bcrypt.hash('admin123', salt);
      
//       await connection.query(
//         'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
//         ['Admin User', 'admin@example.com', adminPassword, 'admin']
//       );
      
//       // Create sample parking locations
//       const locations = [
//         { name: 'Downtown Parking', latitude: 40.7128, longitude: -74.0060, totalSlots: 100, coverImage: '/uploads/downtown.jpg' },
//         { name: 'Central Mall Parking', latitude: 40.7138, longitude: -74.0070, totalSlots: 200, coverImage: '/uploads/mall.jpg' },
//         { name: 'Airport Parking', latitude: 40.7148, longitude: -74.0080, totalSlots: 500, coverImage: '/uploads/airport.jpg' }
//       ];
      
//       for (const location of locations) {
//         await connection.query(
//           'INSERT INTO parking_locations (name, latitude, longitude, total_slots, available_slots, cover_image_url) VALUES (?, ?, ?, ?, ?, ?)',
//           [location.name, location.latitude, location.longitude, location.totalSlots, location.totalSlots, location.coverImage]
//         );
//       }
      
//       // Set default hourly rate
//       await connection.query('INSERT INTO settings (id, hourly_rate) VALUES (1, 2.0)');
      
//       // Create sample employees
//       const employeePassword = await bcrypt.hash('employee123', salt);
      
//       await connection.query(
//         'INSERT INTO users (name, email, password, role, parking_location_id) VALUES (?, ?, ?, ?, ?)',
//         ['John Employee', 'john@example.com', employeePassword, 'employee', 1]
//       );
      
//       await connection.query(
//         'INSERT INTO users (name, email, password, role, parking_location_id) VALUES (?, ?, ?, ?, ?)',
//         ['Jane Employee', 'jane@example.com', employeePassword, 'employee', 2]
//       );
      
//       // Create sample users
//       const userPassword = await bcrypt.hash('user123', salt);
      
//       await connection.query(
//         'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
//         ['Alice User', 'alice@example.com', userPassword, 'user']
//       );
      
//       await connection.query(
//         'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
//         ['Bob User', 'bob@example.com', userPassword, 'user']
//       );
      
//       await connection.query(
//         'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
//         ['Charlie User', 'charlie@example.com', userPassword, 'user']
//       );
      
//       console.log('Seed data created successfully!');
//     } else {
//       console.log('Seed data already exists, skipping...');
//     }
    
//     connection.release();
//     console.log('Database setup completed successfully!');
    
//     // Exit process
//     process.exit(0);
//   } catch (error) {
//     console.error('Error setting up database:', error);
//     process.exit(1);
//   }
// };

// // Run setup
// setupDatabase();