const bcrypt = require('bcryptjs');
const usersRepository = require('../users/users.repository');

const BCRYPT_COST = 10;
// Compared against when the email doesn't exist, so a wrong email and a wrong
// password take the same time and can't be told apart.
const DUMMY_HASH = bcrypt.hashSync('glist-dummy-password', BCRYPT_COST);

class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

async function register({ email, password, displayName }) {
  try {
    return await usersRepository.create({
      email,
      passwordHash: await hashPassword(password),
      displayName
    });
  } catch (error) {
    if (error.code === '23505') {
      throw new AuthError('An account with that email already exists', 409);
    }
    throw error;
  }
}

// Returns the user for a correct email + password, otherwise null.
async function authenticate(email, password) {
  const user = await usersRepository.findByEmailWithPassword(email);
  const matches = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);

  if (!user || !matches) return null;
  if (user.is_disabled) {
    throw new AuthError('This account has been disabled. Contact an admin.', 403);
  }
  return user;
}

async function verifyPassword(userId, password) {
  const hash = await usersRepository.findPasswordHash(userId);
  return Boolean(hash) && bcrypt.compare(password, hash);
}

module.exports = { AuthError, hashPassword, register, authenticate, verifyPassword };
