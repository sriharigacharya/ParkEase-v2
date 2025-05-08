// server/middleware/auth.js
import jwt from 'jsonwebtoken';

// Middleware to verify JWT token and roles
const verifyToken = (allowedRoles = []) => {
  return (req, res, next) => {
    console.log('\n[verifyToken] Middleware invoked for path:', req.originalUrl); // Log: Entry point
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('[verifyToken] Access denied. No token provided.'); // Log: No token found
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Log crucial parts of the decoded token, especially id and role
      console.log('[verifyToken] Token decoded. User ID:', decoded.id, 'Role:', decoded.role, 'Payload:', decoded); // Log: Decoded token details
      
      // Add user data to request
      req.user = decoded;

      // Check role if any roles are specified
      if (allowedRoles.length > 0) {
        console.log(`[verifyToken] Performing role check. User role: '${req.user.role}', Allowed roles: [${allowedRoles.join(', ')}]`); // Log: Role check details
        if (!allowedRoles.includes(req.user.role)) {
          console.log('[verifyToken] Role check FAILED.'); // Log: Role check outcome
          return res.status(403).json({ message: 'Insufficient permissions' });
        }
        console.log('[verifyToken] Role check PASSED.'); // Log: Role check outcome
      } else {
        console.log('[verifyToken] No specific roles required for this route.'); // Log: No roles to check
      }

      console.log('[verifyToken] Auth success, calling next() for user ID:', req.user.id, 'role:', req.user.role); // Log: Success and calling next()
      next();
    } catch (error) {
      // Your original console.error is good. Let's make sure we see the error message clearly.
      console.error('[verifyToken] Token verification EXCEPTION:', error.name, '-', error.message); // Log: Exception details
      // For more detail during debugging, you could log the full error object: console.error(error);
      return res.status(401).json({ message: 'Invalid token' }); // Keeping 401 as per your original for consistency on catch
    }
  };
};

export { verifyToken }; // This named export is correct