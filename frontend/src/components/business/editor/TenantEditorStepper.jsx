import { Button } from '@/components/common/Button.jsx';
import { SectionEyebrow } from './TenantEditorPrimitives.jsx';

export function TenantEditorStepper({
  steps,
  activeStep,
  activeStepIndex,
  localError,
  onStepChange,
  variant = 'default',
  hasUnsavedChanges = false,
}) {
  const currentStep = steps[activeStepIndex];
  const isSideVariant = variant === 'side';

  return (
    <div className={`admin-card-stack admin-card-stack--airy${isSideVariant ? ' admin-editor-section-nav' : ''}`}>
      <div className="admin-panel-card__header">
        <div>
          <SectionEyebrow>{isSideVariant ? 'Editor' : 'Fluxo'}</SectionEyebrow>
          <h2>{isSideVariant ? 'Secoes do tenant' : 'Fluxo do editor'}</h2>
          <p>{isSideVariant ? 'Abra apenas o contexto que precisa editar agora.' : 'Navegue por etapas para ajustar o tenant com mais foco e menos densidade visual.'}</p>
        </div>
        <div className="admin-editor-section-nav__badges">
          <span className="admin-section-chip admin-section-chip--accent">
            {activeStepIndex + 1}/{steps.length}
          </span>
          {hasUnsavedChanges ? (
            <span className="admin-section-chip admin-section-chip--warning">Alteracoes nao salvas</span>
          ) : null}
        </div>
      </div>

      <div className={`admin-stepper admin-stepper--dashboard${isSideVariant ? ' admin-stepper--side' : ''}`}>
        {steps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            className={`admin-stepper__item ${activeStep === step.id ? 'admin-stepper__item--active' : ''}`}
            aria-label={step.label}
            aria-current={activeStep === step.id ? 'step' : undefined}
            title={step.label}
            onClick={() => onStepChange(step.id)}
          >
            <span className="admin-stepper__index">{index + 1}</span>
            <span className="admin-stepper__copy">
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </span>
          </button>
        ))}
      </div>

      <div className="admin-stepper-footer">
        <div className="admin-inline-note admin-inline-note--step">
          <strong>{currentStep?.label}</strong>
          <span>{currentStep?.description}</span>
        </div>
        <div className="admin-inline-actions">
          <Button variant="secondary" disabled={activeStepIndex <= 0} onClick={() => onStepChange(steps[Math.max(0, activeStepIndex - 1)].id)}>
            Voltar
          </Button>
          <Button
            variant="secondary"
            disabled={activeStepIndex >= steps.length - 1}
            onClick={() => onStepChange(steps[Math.min(steps.length - 1, activeStepIndex + 1)].id)}
          >
            Proxima etapa
          </Button>
        </div>
      </div>

      {localError ? <p className="admin-status-banner admin-status-banner--error">{localError}</p> : null}
    </div>
  );
}
