import { User } from '../models/User.js';

export async function findUserByEmail(email) {
  return User.findOne({ email: String(email || '').trim().toLowerCase() });
}

export async function findUserById(userId) {
  return User.findById(userId);
}

export async function createUser(payload) {
  return User.create(payload);
}

export async function updateUser(userId, payload) {
  return User.findByIdAndUpdate(userId, payload, {
    new: true,
    runValidators: true,
  });
}

export async function listUsers(filter = {}, options = {}) {
  const query = User.find(filter);

  if (options.sort) {
    query.sort(options.sort);
  }

  if (options.limit) {
    query.limit(options.limit);
  }

  return query.lean();
}

export async function findClientUserById(userId) {
  return User.findOne({
    _id: userId,
    roleLevel: { $gte: 2 },
  });
}

export async function listClientUsers(filter = {}) {
  return User.find({
    roleLevel: { $gte: 2 },
    ...filter,
  })
    .sort({ createdAt: -1 })
    .lean();
}

export async function isUserEmailTaken(email, excludedUserId = null) {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const filter = {
    email: normalizedEmail,
  };

  if (excludedUserId) {
    filter._id = { $ne: excludedUserId };
  }

  return Boolean(await User.exists(filter));
}

export async function countAdminUsers() {
  return User.countDocuments();
}

export async function findAdminUserByEmail(email) {
  return findUserByEmail(email);
}

export async function findAdminUserById(userId) {
  return findUserById(userId);
}

export async function createAdminUser(payload) {
  return createUser(payload);
}

export async function updateAdminUser(userId, payload) {
  return updateUser(userId, payload);
}
