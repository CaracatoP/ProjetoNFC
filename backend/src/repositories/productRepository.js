import { Product } from '../models/Product.js';

export function listProductsByBusinessId(businessId, options = {}) {
  const filter = { businessId };

  if (options.activeOnly) {
    filter.active = true;
  }

  return Product.find(filter).sort({ active: -1, createdAt: -1 }).lean();
}

export function countProductsByBusinessId(businessId) {
  return Product.countDocuments({ businessId });
}

export function countUnavailableProductsByBusinessId(businessId) {
  return Product.countDocuments({ businessId, isAvailable: false });
}

export function countInventoryControlledProductsByBusinessId(businessId) {
  return Product.countDocuments({ businessId, 'inventory.enabled': true });
}

export function countLowStockProductsByBusinessId(businessId) {
  return Product.countDocuments({
    businessId,
    'inventory.enabled': true,
    $expr: {
      $lte: ['$inventory.quantity', '$inventory.minimumQuantity'],
    },
  });
}

export function createProductRecord(payload) {
  return Product.create(payload);
}

export function listProductsByBusinessIdAndIds(businessId, ids = [], options = {}) {
  const filter = {
    businessId,
    _id: { $in: ids },
  };

  if (options.activeOnly) {
    filter.active = true;
  }

  return Product.find(filter).lean();
}

export function findProductById(id) {
  return Product.findById(id);
}

export function updateProductRecord(id, payload) {
  return Product.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
}

export function updateProductRecordByBusinessId(businessId, id, payload) {
  return Product.findOneAndUpdate({ _id: id, businessId }, payload, { new: true, runValidators: true });
}

export function deleteProductRecord(id) {
  return Product.findByIdAndDelete(id);
}

export function deleteProductRecordByBusinessId(businessId, id) {
  return Product.findOneAndDelete({ _id: id, businessId });
}
