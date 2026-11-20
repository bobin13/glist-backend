const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function isUuid(value) {
  return typeof value === 'string' && uuidPattern.test(value);
}

function email(value) {
  if (typeof value !== 'string' || value.trim().length > 254 || !emailPattern.test(value.trim())) {
    throw new ValidationError('A valid email address is required');
  }
  return value.trim();
}

function password(value) {
  // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated.
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value) > 72) {
    throw new ValidationError('Password must be between 8 and 72 characters');
  }
  return value;
}

function name(value, label = 'Name', maxLength = 60) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
    throw new ValidationError(`${label} must be between 1 and ${maxLength} characters`);
  }
  return value.trim();
}

function boolean(value, label) {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${label} must be true or false`);
  }
  return value;
}

module.exports = { ValidationError, isUuid, email, password, name, boolean };
