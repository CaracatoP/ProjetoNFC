import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';

function getCreatorSignatureFallback() {
  return {
    title: 'Feito por Caraçato',
    description: 'Entre em contato pelo Instagram @caracato_.',
    settings: {
      variant: 'footer-signature',
      eyebrow: 'Criacao do site',
      primaryAction: {
        label: 'Instagram @caracato_',
        href: 'https://instagram.com/caracato_',
      },
    },
  };
}

export function BusinessCtaSection({ section, onBusinessAction, onTrackAction }) {
  const fallback = getCreatorSignatureFallback();
  const settings = {
    ...fallback.settings,
    ...(section.settings || {}),
    primaryAction: {
      ...fallback.settings.primaryAction,
      ...(section.settings?.primaryAction || {}),
    },
  };
  const title = section.title || fallback.title;
  const description = section.description || fallback.description;
  const eyebrow = settings.eyebrow || fallback.settings.eyebrow;
  const primaryAction = settings.primaryAction;
  const secondaryAction = settings.secondaryAction;

  function trackCtaClick(targetType, targetLabel) {
    onTrackAction?.({
      eventType: 'cta_click',
      sectionType: 'cta',
      targetType,
      targetLabel,
    });
  }

  function handleAction(actionConfig, targetType) {
    if (!actionConfig) {
      return;
    }

    trackCtaClick(targetType, actionConfig.label);

    if (actionConfig.action) {
      onBusinessAction?.(actionConfig);
    }
  }

  return (
    <Card className="section-card cta-card cta-card--footer">
      <div className="cta-footer">
        <div className="cta-footer__copy">
          {eyebrow ? <span className="section-eyebrow">{eyebrow}</span> : null}
          {title ? <strong>{title}</strong> : null}
          {description ? <p>{description}</p> : null}
        </div>
        <div className="cta-footer__actions">
          {primaryAction?.href ? (
            <Button
              href={primaryAction.href}
              target="_blank"
              variant="secondary"
              className="cta-footer__button"
              onClick={() => trackCtaClick('primary', primaryAction.label)}
            >
              {primaryAction.label}
            </Button>
          ) : primaryAction ? (
            <Button
              variant="secondary"
              className="cta-footer__button"
              onClick={() => handleAction(primaryAction, 'primary')}
            >
              {primaryAction.label}
            </Button>
          ) : null}

          {secondaryAction?.href ? (
            <Button
              href={secondaryAction.href}
              target="_blank"
              variant="secondary"
              className="cta-footer__button"
              onClick={() => trackCtaClick('secondary', secondaryAction.label)}
            >
              {secondaryAction.label}
            </Button>
          ) : secondaryAction ? (
            <Button
              variant="secondary"
              className="cta-footer__button"
              onClick={() => handleAction(secondaryAction, 'secondary')}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
