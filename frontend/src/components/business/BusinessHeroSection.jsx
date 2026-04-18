import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';

function normalizeComparableText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function MetaPill({ label, value }) {
  if (!value) {
    return null;
  }

  return (
    <div className="meta-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function BusinessHeroSection({ business, section, onBusinessAction, onTrackAction }) {
  const { settings = {} } = section;
  const badge = business.badge || settings.badge;
  const title = business.name || section.title;
  const shouldHideDuplicateBadge =
    normalizeComparableText(badge) && normalizeComparableText(badge) === normalizeComparableText(title);
  const description = business.description || section.description;
  const logoUrl = business.logoUrl || settings.logoUrl;
  const bannerUrl = business.bannerUrl || settings.bannerUrl;
  const primaryAction = settings.primaryAction;
  const secondaryAction = settings.secondaryAction;

  function trackHeroAction(targetLabel) {
    onTrackAction?.({
      eventType: 'cta_click',
      sectionType: 'hero',
      targetType: 'hero_action',
      targetLabel,
    });
  }

  function handleConfigAction(action) {
    if (!action) {
      return;
    }

    trackHeroAction(action.label);

    if (action.action) {
      onBusinessAction?.(action);
    }
  }

  return (
    <Card className="hero-card">
      <div className="hero-card__content">
        {logoUrl ? (
          <div className="hero-card__branding">
            <img className="hero-card__logo" src={logoUrl} alt={`Logo ${business.name}`} />
          </div>
        ) : null}

        <SectionHeader
          eyebrow={shouldHideDuplicateBadge ? '' : badge}
          title={title}
          description={description}
        />

        <div className="hero-card__meta">
          <MetaPill label="Avaliação" value={settings.rating} />
          <MetaPill label="Endereço" value={settings.address} />
          <MetaPill
            label="Horário"
            value={Array.isArray(settings.hours) && settings.hours.length ? settings.hours[0].value : ''}
          />
        </div>

        <div className="hero-card__actions">
          {primaryAction?.href ? (
            <Button
              href={primaryAction.href}
              target="_blank"
              onClick={() => trackHeroAction(primaryAction.label)}
            >
              {primaryAction.label}
            </Button>
          ) : primaryAction ? (
            <Button onClick={() => handleConfigAction(primaryAction)}>{primaryAction.label}</Button>
          ) : null}

          {secondaryAction?.href ? (
            <Button
              href={secondaryAction.href}
              target="_blank"
              variant="secondary"
              onClick={() => trackHeroAction(secondaryAction.label)}
            >
              {secondaryAction.label}
            </Button>
          ) : secondaryAction ? (
            <Button
              variant="secondary"
              onClick={() => handleConfigAction(secondaryAction)}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="hero-card__visual">
        {bannerUrl ? <img src={bannerUrl} alt={business.name} /> : null}
      </div>
    </Card>
  );
}
