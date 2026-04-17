import { Business } from '../models/Business.js';
import { BusinessLink } from '../models/BusinessLink.js';
import { BusinessSection } from '../models/BusinessSection.js';
import { BusinessTheme } from '../models/BusinessTheme.js';
import { NfcTag } from '../models/NfcTag.js';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { getLegacyDemoSeed } from './legacyDemoSeed.js';

async function findSeedBusiness(seed) {
  const existingTag = await NfcTag.findOne({ code: seed.nfcTag.code }).lean();

  if (existingTag?.businessId) {
    const business = await Business.findById(existingTag.businessId);

    if (business) {
      return business;
    }
  }

  return Business.findOne({ slug: seed.business.slug });
}

async function resetSeedGraph(seed) {
  const existingTag = await NfcTag.findOne({ code: seed.nfcTag.code }).lean();
  const existingBusiness = await Business.findOne({ slug: seed.business.slug }).lean();
  const businessIds = [existingTag?.businessId, existingBusiness?._id]
    .filter(Boolean)
    .map((value) => value.toString())
    .filter((value, index, array) => array.indexOf(value) === index);

  if (!businessIds.length) {
    await NfcTag.deleteMany({ code: seed.nfcTag.code });
    return;
  }

  await Promise.all([
    Business.deleteMany({ _id: { $in: businessIds } }),
    BusinessTheme.deleteMany({ businessId: { $in: businessIds } }),
    BusinessSection.deleteMany({ businessId: { $in: businessIds } }),
    BusinessLink.deleteMany({ businessId: { $in: businessIds } }),
    NfcTag.deleteMany({
      $or: [{ businessId: { $in: businessIds } }, { code: seed.nfcTag.code }],
    }),
    Subscription.deleteMany({ businessId: { $in: businessIds } }),
  ]);
}

export async function seedDemoData(options = {}) {
  const { reset = false } = options;
  const seed = getLegacyDemoSeed();
  
  if (reset) {
    await resetSeedGraph(seed);
  }

  let business = await findSeedBusiness(seed);

  if (!business) {
    business = await Business.create(seed.business);
  }

  const existingTheme = await BusinessTheme.findOne({ businessId: business._id }).lean();
  if (reset || !existingTheme) {
    await BusinessTheme.findOneAndUpdate(
      { businessId: business._id },
      { ...seed.theme, businessId: business._id },
      { upsert: true, new: true },
    );
  }

  const [existingSectionsCount, existingLinksCount] = await Promise.all([
    BusinessSection.countDocuments({ businessId: business._id }),
    BusinessLink.countDocuments({ businessId: business._id }),
  ]);

  if (reset || !existingSectionsCount) {
    await BusinessSection.deleteMany({ businessId: business._id });
    await BusinessSection.insertMany(
      seed.sections.map((section) => ({
        ...section,
        businessId: business._id,
      })),
    );
  }

  if (reset || !existingLinksCount) {
    await BusinessLink.deleteMany({ businessId: business._id });
    await BusinessLink.insertMany(
      seed.links.map((link) => ({
        ...link,
        businessId: business._id,
      })),
    );
  }

  const existingNfcTag = await NfcTag.findOne({ businessId: business._id }).lean();
  if (reset || !existingNfcTag) {
    await NfcTag.findOneAndUpdate(
      { businessId: business._id },
      { ...seed.nfcTag, businessId: business._id },
      { upsert: true, new: true },
    );
  }

  const plan = await Plan.findOneAndUpdate({ code: seed.plan.code }, seed.plan, {
    upsert: true,
    new: true,
  });

  await Subscription.findOneAndUpdate(
    { businessId: business._id },
    {
      businessId: business._id,
      planId: plan._id,
      status: 'active',
      provider: 'manual-demo',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
    { upsert: true, new: true },
  );

  return {
    businessId: business._id.toString(),
    slug: business.slug,
    tagCode: seed.nfcTag.code,
  };
}
