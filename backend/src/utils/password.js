import bcrypt from 'bcryptjs';

const PASSWORD_SALT_ROUNDS = 10;

export async function hashPassword(value) {
  return bcrypt.hash(String(value || ''), PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(value, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(String(value || ''), passwordHash);
}
