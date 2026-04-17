import { Business } from '../models/Business.js';
import { BusinessLink } from '../models/BusinessLink.js';
import { BusinessSection } from '../models/BusinessSection.js';
import { BusinessTheme } from '../models/BusinessTheme.js';
import { NfcTag } from '../models/NfcTag.js';
import { Plan } from '../models/Plan.js';
import { Subscription } from '../models/Subscription.js';
import { getLegacyDemoSeed } from './legacyDemoSeed.js';

export async function seedDemoData() {
  const seed = getLegacyDemoSeed();

  let business = await Business.findOne({ slug: seed.business.slug });

  if (!business) {
    business = await Business.create(seed.business);
  } else {
    Object.assign(business, seed.business);
    await business.save();
  }

  await BusinessTheme.findOneAndUpdate(
    { businessId: business._id },
    { ...seed.theme, businessId: business._id },
    { upsert: true, new: true },
  );

  await BusinessSection.deleteMany({ businessId: business._id });
  await BusinessLink.deleteMany({ businessId: business._id });

  await BusinessSection.insertMany(
    seed.sections.map((section) => ({
      ...section,
      businessId: business._id,
    })),
  );

  await BusinessLink.insertMany(
    seed.links.map((link) => ({
      ...link,
      businessId: business._id,
    })),
  );

  await NfcTag.findOneAndUpdate(
    { code: seed.nfcTag.code },
    { ...seed.nfcTag, businessId: business._id },
    { upsert: true, new: true },
  );

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

