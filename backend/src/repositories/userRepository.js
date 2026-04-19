import { User } from '../models/User.js';

export async function findAdminUserByEmail(email) {
  return User.findOne({ email: String(email || '').trim().toLowerCase() });
}

export async function findAdminUserById(userId) {
  return User.findById(userId);
}

export async function createAdminUser(payload) {
  return User.create(payload);
}

export async function updateAdminUser(userId, payload) {
  return User.findByIdAndUpdate(userId, payload, {
    new: true,
    runValidators: true,
  });
}

export async function countAdminUsers() {
  return User.countDocuments();
}
