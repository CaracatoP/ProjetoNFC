import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';
import { formatCurrency, resolveMediaUrl } from '@/utils/formatters.js';

export function BusinessServicesSection({ section }) {
  if (!section.items?.length) {
    return null;
  }

  return (
    <Card className="section-card">
      <SectionHeader title={section.title} description={section.description} />
      <div className="service-grid">
        {section.items.map((service) => {
          const serviceImageUrl = resolveMediaUrl(service.imageUrl, {
            width: 640,
            height: 360,
            fit: 'fill',
          });

          return (
            <article key={service.id} className="service-card">
              {serviceImageUrl ? (
                <div className="service-card__media">
                  <img
                    className="service-card__image"
                    src={serviceImageUrl}
                    alt={service.name}
                    width="640"
                    height="360"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}

              <div className="service-card__content">
                <div className="service-card__header">
                  <h3>{service.name}</h3>
                  <strong className="service-card__price">{formatCurrency(service.price)}</strong>
                </div>

                {service.description ? <p className="service-card__description">{service.description}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </Card>
  );
}
