import { useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { SectionHeader } from '@/components/common/SectionHeader.jsx';
import { formatCurrency } from '@/utils/formatters.js';

function initialAppointmentState() {
  return {
    serviceId: '',
    professionalId: '',
    customerName: '',
    customerPhone: '',
    requestedDate: '',
    requestedTime: '',
    notes: '',
  };
}

export function BusinessAppointmentsSection({
  segmentConfig,
  professionals = [],
  appointmentServices = [],
  onSubmitAppointment,
  onTrackAction,
}) {
  const [form, setForm] = useState(initialAppointmentState);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  if (!professionals.length || !appointmentServices.length) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.serviceId || !form.professionalId || !form.customerName.trim() || !form.customerPhone.trim() || !form.requestedDate || !form.requestedTime) {
      return;
    }

    setSubmitting(true);
    setFeedback('');

    try {
      const selectedProfessional = professionals.find((item) => item.id === form.professionalId);
      const selectedService = appointmentServices.find((item) => item.id === form.serviceId);
      await onSubmitAppointment?.({
        professionalId: form.professionalId,
        professionalName: selectedProfessional?.name || '',
        serviceId: form.serviceId,
        serviceName: selectedService?.name || '',
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        requestedDate: form.requestedDate,
        requestedTime: form.requestedTime,
        notes: form.notes.trim(),
      });
      onTrackAction?.({
        eventType: 'cta_click',
        targetType: 'appointment_request',
        targetLabel: selectedService?.name || 'Solicitar agendamento',
        sectionType: 'appointments',
      });
      setForm(initialAppointmentState());
      setFeedback('Solicitacao enviada com sucesso. Aguarde a confirmacao do tenant para validar o horario.');
    } catch (error) {
      setFeedback(error?.message || 'Nao foi possivel enviar a solicitacao agora.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="section-card">
      <SectionHeader
        eyebrow="Modulo ativo"
        title={segmentConfig?.appointmentTitle || 'Solicitar agendamento'}
        description={segmentConfig?.appointmentDescription || 'Escolha o servico, o profissional e envie um pedido de horario.'}
      />

      <div className="appointment-service-list">
        {appointmentServices.map((service) => (
          <div key={service.id} className="appointment-service-pill">
            <strong>{service.name}</strong>
            <span>{service.durationMinutes} min • {formatCurrency(service.price)}</span>
          </div>
        ))}
      </div>

      <form className="appointment-form" onSubmit={handleSubmit}>
        <div className="admin-form-grid">
          <label className="admin-field">
            <span>Servico</span>
            <select value={form.serviceId} onChange={(event) => setForm((current) => ({ ...current, serviceId: event.target.value }))}>
              <option value="">Selecione</option>
              {appointmentServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Profissional</span>
            <select value={form.professionalId} onChange={(event) => setForm((current) => ({ ...current, professionalId: event.target.value }))}>
              <option value="">Selecione</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field">
            <span>Nome</span>
            <input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Telefone</span>
            <input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Data desejada</span>
            <input type="date" value={form.requestedDate} onChange={(event) => setForm((current) => ({ ...current, requestedDate: event.target.value }))} />
          </label>
          <label className="admin-field">
            <span>Horario</span>
            <input type="time" value={form.requestedTime} onChange={(event) => setForm((current) => ({ ...current, requestedTime: event.target.value }))} />
          </label>
        </div>
        <label className="admin-field">
          <span>Observacoes</span>
          <textarea rows="3" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar solicitacao'}
        </Button>
        {feedback ? <p className="site-inline-feedback">{feedback}</p> : null}
      </form>
    </Card>
  );
}
