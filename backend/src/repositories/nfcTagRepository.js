import { NfcTag } from '../models/NfcTag.js';

export async function findTagByCode(code) {
  return NfcTag.findOne({ code }).populate('businessId').lean();
}

export async function touchTag(code) {
  await NfcTag.findOneAndUpdate({ code }, { lastResolvedAt: new Date() });
}

