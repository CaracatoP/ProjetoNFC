import { getSectionAnchor } from '@/utils/sections.js';
import { BusinessContactSection } from './BusinessContactSection.jsx';
import { BusinessCtaSection } from './BusinessCtaSection.jsx';
import { BusinessCustomSection } from './BusinessCustomSection.jsx';
import { BusinessGallerySection } from './BusinessGallerySection.jsx';
import { BusinessHeroSection } from './BusinessHeroSection.jsx';
import { BusinessLinksSection } from './BusinessLinksSection.jsx';
import { BusinessMapSection } from './BusinessMapSection.jsx';
import { BusinessPixSection } from './BusinessPixSection.jsx';
import { BusinessReviewsSection } from './BusinessReviewsSection.jsx';
import { BusinessServicesSection } from './BusinessServicesSection.jsx';
import { BusinessSocialSection } from './BusinessSocialSection.jsx';
import { BusinessWifiSection } from './BusinessWifiSection.jsx';

const componentMap = {
  hero: BusinessHeroSection,
  links: BusinessLinksSection,
  services: BusinessServicesSection,
  contact: BusinessContactSection,
  wifi: BusinessWifiSection,
  pix: BusinessPixSection,
  social: BusinessSocialSection,
  map: BusinessMapSection,
  gallery: BusinessGallerySection,
  reviews: BusinessReviewsSection,
  cta: BusinessCtaSection,
  custom: BusinessCustomSection,
};

export function SectionRenderer(props) {
  const Component = componentMap[props.section.type];

  if (!Component || props.section.visible === false || props.section.settings?.displayMode === 'modal') {
    return null;
  }

  return (
    <section id={getSectionAnchor(props.section.key)} className="site-section">
      <Component {...props} />
    </section>
  );
}
