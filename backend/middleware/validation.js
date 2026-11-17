/**
 * PALMLOCK — Input Validation Helper Middleware
 */

function validateRegistration(req, res, next) {
  const { name, email, password } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Valid name is required (minimum 2 characters).'
    });
  }

  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Valid email address is required.'
    });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 8 characters long.'
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required.'
    });
  }

  next();
}

function validateContact(req, res, next) {
  const { name, phone } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'Contact name is required (minimum 2 characters).'
    });
  }

  if (!phone || typeof phone !== 'string' || !/^\+?[0-9\s\-]{10,16}$/.test(phone.trim())) {
    return res.status(400).json({
      success: false,
      error: 'Valid contact phone number is required.'
    });
  }

  next();
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateContact
};
