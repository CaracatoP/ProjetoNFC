import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';

function normalizeAction(actionConfig) {
  if (!actionConfig) {
    return null;
  }

  const label = String(actionConfig.label || '').trim();
  const href = String(actionConfig.href || '').trim();
  const action = String(actionConfig.action || '').trim();

  if (!label && !href && !action) {
    return null;
  }

  return {
    ...actionConfig,
    label,
    href,
    action,
  };
}

export function BusinessCtaSection({ section, onBusinessAction, onTrackAction }) {
  const settings = {
    ...(section.settings || {}),
    primaryAction: normalizeAction(section.settings?.primaryAction),
    secondaryAction: normalizeAction(section.settings?.secondaryAction),
  };
  const title = String(section.title || '').trim();
  const description = String(section.description || '').trim();
  const eyebrow = String(settings.eyebrow || '').trim();
  const primaryAction = settings.primaryAction;
  const secondaryAction = settings.secondaryAction;
  const hasVisibleContent =
    Boolean(eyebrow) ||
    Boolean(title) ||
    Boolean(description) ||
    Boolean(primaryAction?.label) ||
    Boolean(secondaryAction?.label);

  if (!hasVisibleContent) {
    return null;
  }

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
