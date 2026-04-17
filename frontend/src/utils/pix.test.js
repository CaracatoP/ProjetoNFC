import { buildPixPayload, normalizePixKey } from './pix.js';

describe('pix utils', () => {
  it('builds the official static Pix payload example from the BC manual', () => {
    const payload = buildPixPayload({
      keyType: 'random',
      key: '123e4567-e12b-12d1-a456-426655440000',
      receiverName: 'Fulano de Tal',
      city: 'Brasilia',
    });

    expect(payload).toBe(
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
    );
  });

  it('normalizes phone keys using the Pix international format', () => {
    expect(
      normalizePixKey({
        keyType: 'telefone',
        key: '(11) 98888-7777',
      }),
    ).toBe('+5511988887777');
  });

  it('includes the payment amount in the copy and paste payload', () => {
    const payload = buildPixPayload(
      {
        keyType: 'email',
        key: 'pagamentos@example.com',
        receiverName: 'Estilo Vivo',
        city: 'Sao Paulo',
      },
      45,
    );

    expect(payload).toContain('540545.00');
  });
});
