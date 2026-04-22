import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import {
  buildDerivedTheme,
  buildTenantPublicUrlPreview,
  buildValidationErrors,
  cloneDeep,
  EDITOR_STEPS,
  formatAnalyticsTimestamp,
  formatHistoryValue,
  formatWhatsappValue,
  getAnalyticsEventLabel,
  getAnalyticsTargetSummary,
  getFieldStep,
  getInputState,
  getSectionDisplayLabel,
  getSectionTypeLabel,
  HIDDEN_ADMIN_SECTION_KEYS,
  newGalleryItem,
  newHourItem,
  newLinkItem,
  newServiceItem,
  normalizeOptionalHost,
  normalizePhoneDigits,
  slugify,
  updateSectionDraft,
  uploadImageAndPatch,
} from './editor/tenantEditorUtils.js';
import {
  AdminField,
  PreviewImage,
  SectionEyebrow,
  SensitiveInput,
  ThemeColorField,
} from './editor/TenantEditorPrimitives.jsx';
import { TenantEditorHeader } from './editor/TenantEditorHeader.jsx';
import { TenantEditorStepper } from './editor/TenantEditorStepper.jsx';
export function TenantEditorPanel({
  editor,
  saving,
  deleting,
  togglingStatus,
  duplicating,
  onSave,
  onDelete,
  onUpload,
  onToggleStatus,
  onDuplicate,
  onCopyPublicLink,
}) {
  const [draft, setDraft] = useState(editor ? cloneDeep(editor) : null);
  const [uploadingField, setUploadingField] = useState('');
  const [activeStep, setActiveStep] = useState('basic');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setDraft(editor ? cloneDeep(editor) : null);
    setActiveStep('basic');
    setLocalError('');
  }, [editor]);

  const analyticsSummary = useMemo(() => draft?.analytics || null, [draft]);
  const validationErrors = useMemo(() => (draft ? buildValidationErrors(draft) : {}), [draft]);
  const hasBlockingErrors = Object.keys(validationErrors).length > 0;
  const activeStepIndex = EDITOR_STEPS.findIndex((step) => step.id === activeStep);

  useEffect(() => {
    if (!hasBlockingErrors && localError) {
      setLocalError('');
    }
  }, [hasBlockingErrors, localError]);

  if (!draft) {
    return (
      <Card className="admin-panel-card">
        <EmptyState
          title="Nenhum tenant selecionado"
          description="Escolha um comercio na coluna lateral para editar conteudo, branding, links e analytics."
        />
      </Card>
    );
  }

  const servicesSection = draft.sections.find((section) => section.key === 'services');
  const gallerySection = draft.sections.find((section) => section.key === 'gallery');
  const aboutSection = draft.sections.find((section) => section.key === 'about');
  const ctaSection = draft.sections.find((section) => section.key === 'cta');
  const analyticsByEventType = analyticsSummary?.byEventType || [];
  const recentAnalyticsEvents = analyticsSummary?.recentEvents || [];
  const maxAnalyticsEventCount = Math.max(1, ...analyticsByEventType.map((item) => item.count || 0));
  const latestAnalyticsEvent = recentAnalyticsEvents[0] || null;
  const isActive = draft.business.status === 'active';
  const publicUrlPreview = buildTenantPublicUrlPreview(draft.business, editor?.business?.publicUrl);
  const historyEntries = draft.history || [];

  const handleSave = async () => {
    if (hasBlockingErrors) {
      const [firstInvalidPath] = Object.keys(validationErrors);
      setActiveStep(getFieldStep(firstInvalidPath));
      setLocalError('Corrija os campos destacados antes de salvar.');
      return;
    }

    setLocalError('');
    await onSave?.(draft);
  };

  return (
    <div className="admin-editor-stack">
      <Card className="admin-panel-card admin-panel-card--hero">
        <TenantEditorHeader
          business={draft.business}
          nfcTag={draft.nfcTag}
          totalEvents={analyticsSummary?.totalEvents}
          publicUrl={publicUrlPreview.preferredUrl}
          isActive={isActive}
          saving={saving}
          deleting={deleting}
          duplicating={duplicating}
          togglingStatus={togglingStatus}
          onCopyPublicLink={onCopyPublicLink}
          onDuplicate={onDuplicate}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          onSave={handleSave}
        />
      </Card>

      <Card className="admin-panel-card admin-panel-card--controls">
        <TenantEditorStepper
          steps={EDITOR_STEPS}
          activeStep={activeStep}
          activeStepIndex={activeStepIndex}
          localError={localError}
          onStepChange={setActiveStep}
        />
      </Card>

      <div className="admin-editor-grid">
        {activeStep === 'basic' ? (
          <>
        <Card id="tenant-identity" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Base</SectionEyebrow>
              <h2>Identidade do tenant</h2>
              <p>Dados basicos, slug, status e apresentacao da pagina.</p>
            </div>
          </div>

          <div className="admin-card-stack admin-card-stack--airy">
          <div className="admin-form-grid">
            <AdminField label="Nome do comercio" error={validationErrors['business.name']}>
              <input
                value={draft.business.name}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, name: event.target.value },
                }))}
                {...getInputState(validationErrors['business.name'])}
              />
            </AdminField>
            <AdminField label="Slug publico" error={validationErrors['business.slug']}>
              <input
                value={draft.business.slug}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, slug: slugify(event.target.value, { preserveTrailingSeparator: true }) },
                }))}
                onBlur={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, slug: slugify(event.target.value) },
                }))}
                {...getInputState(validationErrors['business.slug'])}
              />
            </AdminField>
            <AdminField label="Status">
              <select
                value={draft.business.status}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, status: event.target.value },
                }))}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </AdminField>
            <AdminField
              label="Subdominio do cliente"
              description="Opcional. Exemplo: studio-exemplo gera um preview como studio-exemplo.seu-dominio.com."
            >
              <input
                value={draft.business.domains?.subdomain || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    domains: {
                      ...(current.business.domains || {}),
                      subdomain: slugify(event.target.value, { preserveTrailingSeparator: true }),
                    },
                  },
                }))}
                onBlur={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    domains: {
                      ...(current.business.domains || {}),
                      subdomain: slugify(event.target.value),
                    },
                  },
                }))}
                placeholder="studio-exemplo"
              />
            </AdminField>
            <AdminField
              label="Dominio customizado"
              description="Opcional. Informe apenas o host, por exemplo cliente.com.br."
              error={validationErrors['business.domains.customDomain']}
            >
              <input
                value={draft.business.domains?.customDomain || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    domains: {
                      ...(current.business.domains || {}),
                      customDomain: normalizeOptionalHost(event.target.value),
                    },
                  },
                }))}
                placeholder="cliente.com.br"
                {...getInputState(validationErrors['business.domains.customDomain'])}
              />
            </AdminField>
            <AdminField label="Badge">
              <input
                value={draft.business.badge || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, badge: event.target.value },
                }))}
              />
            </AdminField>
            <AdminField label="Avaliacao">
              <input
                value={draft.business.rating || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, rating: event.target.value },
                }))}
              />
            </AdminField>
            <SensitiveInput
              label="Codigo da tag NFC"
              value={draft.nfcTag?.code || ''}
              onChange={(event) => setDraft((current) => ({
                ...current,
                nfcTag: { ...(current.nfcTag || {}), code: event.target.value, status: current.nfcTag?.status || 'active' },
              }))}
              placeholder="Codigo interno da tag"
            />
          </div>

          <AdminField label="Descricao principal">
            <textarea
              rows="4"
              value={draft.business.description || ''}
              onChange={(event) => setDraft((current) => ({
                ...current,
                business: { ...current.business, description: event.target.value },
              }))}
            />
          </AdminField>

          <div className="admin-inline-note">
            <strong>URL publica</strong>
            <span>{publicUrlPreview.preferredUrl || 'Preencha slug, subdominio ou dominio customizado para gerar uma URL publica.'}</span>
          </div>

          <div className="admin-domain-preview-grid">
            <div className="admin-domain-preview-card">
              <strong>Slug atual</strong>
              <span>{publicUrlPreview.slugUrl || 'Ainda nao definido'}</span>
            </div>
            <div className="admin-domain-preview-card">
              <strong>Preview por subdominio</strong>
              <span>{publicUrlPreview.subdomainUrl || 'Nenhum subdominio configurado'}</span>
            </div>
            <div className="admin-domain-preview-card">
              <strong>Preview por dominio</strong>
              <span>{publicUrlPreview.customDomainUrl || 'Nenhum dominio customizado configurado'}</span>
            </div>
          </div>
          </div>
        </Card>

          </>
        ) : null}

        {activeStep === 'visual' ? (
        <Card id="tenant-media" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Visual</SectionEyebrow>
              <h2>Logo, banner e uploads</h2>
              <p>Suba logo, icone do site e banner com upload centralizado no Cloudinary e persistencia segura por tenant.</p>
            </div>
          </div>

          <div className="admin-card-stack">
          <div className="admin-media-grid admin-media-grid--assets">
            <div className="admin-media-card">
              <PreviewImage src={draft.business.logoUrl} alt={draft.business.name} />
              <AdminField label="Logo URL" error={validationErrors['business.logoUrl']}>
                <input
                  value={draft.business.logoUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      logoUrl: event.target.value,
                      logoPublicId: '',
                    },
                  }))}
                  {...getInputState(validationErrors['business.logoUrl'])}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('logo');
                  await uploadImageAndPatch(file, onUpload, {
                    tenantSlug: draft.business.slug,
                    assetType: 'logo',
                  }, (upload) =>
                    setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        logoUrl: upload.url,
                        logoPublicId: upload.publicId || '',
                      },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'logo' ? <small>Enviando logo...</small> : null}
            </div>

            <div className="admin-media-card">
              <PreviewImage src={draft.business.seo?.imageUrl} alt={`Icone ${draft.business.name}`} />
              <AdminField
                label="Icone do site"
                description="Usado como icone da aba do navegador e identidade curta do site."
                error={validationErrors['business.seo.imageUrl']}
              >
                <input
                  value={draft.business.seo?.imageUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      seo: {
                        ...current.business.seo,
                        imageUrl: event.target.value,
                        imagePublicId: '',
                      },
                    },
                  }))}
                  {...getInputState(validationErrors['business.seo.imageUrl'])}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('site-icon');
                  await uploadImageAndPatch(file, onUpload, {
                    tenantSlug: draft.business.slug,
                    assetType: 'site-icon',
                  }, (upload) =>
                    setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        seo: {
                          ...current.business.seo,
                          imageUrl: upload.url,
                          imagePublicId: upload.publicId || '',
                        },
                      },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'site-icon' ? <small>Enviando icone...</small> : null}
            </div>

            <div className="admin-media-card">
              <PreviewImage src={draft.business.bannerUrl} alt={draft.business.name} />
              <AdminField label="Banner URL" error={validationErrors['business.bannerUrl']}>
                <input
                  value={draft.business.bannerUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      bannerUrl: event.target.value,
                      bannerPublicId: '',
                    },
                  }))}
                  {...getInputState(validationErrors['business.bannerUrl'])}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('banner');
                  await uploadImageAndPatch(file, onUpload, {
                    tenantSlug: draft.business.slug,
                    assetType: 'banner',
                  }, (upload) =>
                    setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        bannerUrl: upload.url,
                        bannerPublicId: upload.publicId || '',
                      },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'banner' ? <small>Enviando banner...</small> : null}
            </div>
          </div>
          </div>
        </Card>
        ) : null}

        {activeStep === 'basic' ? (
          <>
        <Card id="tenant-contact" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Operacao</SectionEyebrow>
              <h2>Contato e atendimento</h2>
              <p>Canais principais, endereco e horario resumido do tenant.</p>
            </div>
          </div>

          <div className="admin-card-stack">
          <div className="admin-form-grid">
            <AdminField label="WhatsApp" error={validationErrors['business.contact.whatsapp']}>
              <input
                value={formatWhatsappValue(draft.business.contact?.whatsapp || '')}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: { ...current.business.contact, whatsapp: normalizePhoneDigits(event.target.value) },
                  },
                }))}
                placeholder="+55 (11) 99999-9999"
                {...getInputState(validationErrors['business.contact.whatsapp'])}
              />
            </AdminField>
            <AdminField label="Telefone">
              <input
                value={draft.business.contact?.phone || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: { ...current.business.contact, phone: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="E-mail">
              <input
                value={draft.business.contact?.email || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: { ...current.business.contact, email: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Endereco">
              <input
                value={draft.business.address?.display || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    address: { ...current.business.address, display: event.target.value },
                  },
                }))}
              />
            </AdminField>
          </div>

          <section className="admin-form-block admin-form-block--soft">
            <div className="admin-panel-card__header admin-panel-card__header--compact">
              <div>
                <h2>Horarios exibidos no site</h2>
                <p>Cadastre os dias ou periodos exatamente como deseja mostrar na pagina publica.</p>
              </div>
              <Button
                variant="secondary"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      hours: [...(current.business.hours || []), newHourItem()],
                    },
                  }))
                }
              >
                Adicionar horario
              </Button>
            </div>

            {draft.business.hours?.length ? (
              <div className="admin-repeater-list admin-repeater-list--hours">
                {draft.business.hours.map((hour, index) => (
                  <div key={hour.id || index} className="admin-repeater-card admin-repeater-card--hour">
                    <div className="admin-form-grid">
                      <AdminField label="Dia ou periodo">
                        <input
                          value={hour.label || ''}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              business: {
                                ...current.business,
                                hours: current.business.hours.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, label: event.target.value } : item,
                                ),
                              },
                            }))
                          }
                          placeholder="Seg-Sex"
                        />
                      </AdminField>
                      <AdminField label="Faixa de horario">
                        <input
                          value={hour.value || ''}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              business: {
                                ...current.business,
                                hours: current.business.hours.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, value: event.target.value } : item,
                                ),
                              },
                            }))
                          }
                          placeholder="09:00 - 18:00 ou Fechado"
                        />
                      </AdminField>
                    </div>

                    <div className="admin-inline-actions">
                      <Button
                        variant="secondary"
                        className="button--danger-tone"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            business: {
                              ...current.business,
                              hours: current.business.hours.filter((_, itemIndex) => itemIndex !== index),
                            },
                          }))
                        }
                      >
                        Remover horario
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-inline-note">
                <strong>Sem horarios configurados</strong>
                <span>Adicione linhas com os dias e faixas que devem aparecer no site. Exemplo: Seg-Sex, Sabado ou Domingo.</span>
              </div>
            )}
          </section>
          </div>
        </Card>
          </>
        ) : null}

        {activeStep === 'payments' ? (
        <Card id="tenant-payments" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Operacao</SectionEyebrow>
              <h2>Pagamentos</h2>
              <p>Configure o PIX do site principal e o Wi-Fi usado no atalho rapido.</p>
            </div>
          </div>

          <div className="admin-card-stack">
          <div className="admin-split-grid admin-split-grid--payments">
            <div className="admin-subpanel admin-subpanel--payment">
              <h3>PIX</h3>
              <div className="admin-form-grid">
                <AdminField label="Tipo de chave">
                  <select
                    value={draft.business.contact?.pix?.keyType || ''}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...current.business.contact,
                          pix: { ...(current.business.contact?.pix || {}), keyType: event.target.value },
                        },
                      },
                    }))}
                  >
                    <option value="">Selecione</option>
                    <option value="cpf">cpf</option>
                    <option value="cnpj">cnpj</option>
                    <option value="email">email</option>
                    <option value="telefone">telefone</option>
                    <option value="aleatoria">aleatoria</option>
                  </select>
                </AdminField>
                <SensitiveInput
                  label="Chave PIX"
                  value={draft.business.contact?.pix?.key || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      contact: {
                        ...current.business.contact,
                        pix: { ...(current.business.contact?.pix || {}), key: event.target.value },
                      },
                    },
                  }))}
                  placeholder="Chave PIX do recebedor"
                />
                <AdminField label="Recebedor">
                  <input
                    value={draft.business.contact?.pix?.receiverName || ''}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...current.business.contact,
                          pix: { ...(current.business.contact?.pix || {}), receiverName: event.target.value },
                        },
                      },
                    }))}
                  />
                </AdminField>
              </div>
            </div>

            <div className="admin-subpanel admin-subpanel--payment">
              <h3>Wi-Fi do atalho rapido</h3>
              <div className="admin-form-grid">
                <AdminField label="SSID">
                  <input
                    value={draft.business.contact?.wifi?.ssid || ''}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      business: {
                        ...current.business,
                        contact: {
                          ...current.business.contact,
                          wifi: { ...(current.business.contact?.wifi || {}), ssid: event.target.value },
                        },
                      },
                    }))}
                  />
                </AdminField>
                <SensitiveInput
                  label="Senha"
                  value={draft.business.contact?.wifi?.password || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: {
                      ...current.business,
                      contact: {
                        ...current.business.contact,
                        wifi: { ...(current.business.contact?.wifi || {}), password: event.target.value },
                      },
                    },
                  }))}
                  placeholder="Senha do Wi-Fi"
                />
              </div>
            </div>
          </div>
          </div>
        </Card>
        ) : null}

        {activeStep === 'links' ? (
        <Card id="tenant-links" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Atalhos</SectionEyebrow>
              <h2>Links e atalhos</h2>
              <p>Edite os botoes de acesso rapido e outros links agrupados do tenant.</p>
            </div>
            <Button variant="secondary" onClick={() => setDraft((current) => ({ ...current, links: [...current.links, newLinkItem()] }))}>
              Adicionar link
            </Button>
          </div>

          <div className="admin-card-stack">
          <div className="admin-repeater-list admin-repeater-list--links">
            {draft.links.map((link, index) => (
              <div key={link.id || index} className="admin-repeater-card">
                <div className="admin-form-grid">
                  <AdminField label="Label">
                    <input
                      value={link.label || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], label: event.target.value };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                  <AdminField label="Subtitulo">
                    <input
                      value={link.subtitle || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], subtitle: event.target.value };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                  <AdminField label="Tipo">
                    <select
                      value={link.type}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], type: event.target.value };
                        return { ...current, links };
                      })}
                    >
                      <option value="external">link externo</option>
                      <option value="contact">contato</option>
                      <option value="social">instagram / social</option>
                      <option value="wifi">wi-fi</option>
                      <option value="pix">pix</option>
                    </select>
                  </AdminField>
                  <AdminField label="Icone">
                    <input
                      value={link.icon || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], icon: event.target.value };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                  <AdminField label="URL" error={validationErrors[`links.${index}.url`]}>
                    <input
                      value={link.url || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], url: event.target.value };
                        return { ...current, links };
                      })}
                      {...getInputState(validationErrors[`links.${index}.url`])}
                    />
                  </AdminField>
                  <AdminField label="Acao interna">
                    <input
                      value={link.metadata?.action || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = {
                          ...links[index],
                          metadata: { ...(links[index].metadata || {}), action: event.target.value },
                        };
                        return { ...current, links };
                      })}
                    />
                  </AdminField>
                </div>
                <div className="admin-inline-actions">
                  <Button
                    variant="secondary"
                    className="button--danger-tone"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      links: current.links.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                  >
                    Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </Card>
        ) : null}

        {activeStep === 'content' ? (
        <Card id="tenant-services-gallery" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Conteudo</SectionEyebrow>
              <h2>Servicos e galeria</h2>
              <p>Conteudo principal da pagina publica do negocio.</p>
            </div>
          </div>

          <div className="admin-card-stack admin-card-stack--airy">
          <section className="admin-form-block admin-form-block--soft">
          <div className="admin-visibility-toggle">
            <label>
              <input
                type="checkbox"
                checked={servicesSection?.visible !== false}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                    section.visible = event.target.checked;
                  });
                  return nextDraft;
                })}
              />
              Exibir secao de servicos
            </label>
            <Button
              variant="secondary"
              onClick={() => setDraft((current) => {
                const nextDraft = cloneDeep(current);
                updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                  section.items = [...(section.items || []), newServiceItem()];
                });
                return nextDraft;
              })}
            >
              Adicionar servico
            </Button>
          </div>

          <div className="admin-repeater-list admin-repeater-list--services">
            {(servicesSection?.items || []).map((service, index) => (
              <div key={service.id || index} className="admin-repeater-card admin-repeater-card--service">
                <div className="admin-form-grid">
                  <AdminField label="Nome">
                    <input
                      value={service.name || ''}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                          section.items[index] = { ...section.items[index], name: event.target.value };
                        });
                        return nextDraft;
                      })}
                    />
                  </AdminField>
                  <AdminField label="Preco">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.price ?? 0}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                          section.items[index] = { ...section.items[index], price: Number(event.target.value) };
                        });
                        return nextDraft;
                      })}
                    />
                  </AdminField>
                </div>
                <AdminField label="Descricao">
                  <textarea
                    rows="3"
                    value={service.description || ''}
                    onChange={(event) => setDraft((current) => {
                      const nextDraft = cloneDeep(current);
                      updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                        section.items[index] = { ...section.items[index], description: event.target.value };
                      });
                      return nextDraft;
                    })}
                  />
                </AdminField>
                <div className="admin-inline-actions">
                  <Button
                    variant="secondary"
                    className="button--danger-tone"
                    onClick={() => setDraft((current) => {
                      const nextDraft = cloneDeep(current);
                      updateSectionDraft(nextDraft, 'services', 'services', (section) => {
                        section.items = section.items.filter((_, itemIndex) => itemIndex !== index);
                      });
                      return nextDraft;
                    })}
                  >
                    Remover servico
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </section>

          <section className="admin-form-block admin-form-block--soft">
          <div className="admin-visibility-toggle">
            <label>
              <input
                type="checkbox"
                checked={gallerySection?.visible === true}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                    section.visible = event.target.checked;
                  });
                  return nextDraft;
                })}
              />
              Exibir galeria
            </label>
            <Button
              variant="secondary"
              onClick={() => setDraft((current) => {
                const nextDraft = cloneDeep(current);
                updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                  section.items = [...(section.items || []), newGalleryItem()];
                });
                return nextDraft;
              })}
            >
              Adicionar foto
            </Button>
          </div>

          <div className="admin-repeater-list admin-repeater-list--gallery">
            {(gallerySection?.items || []).map((image, index) => (
              <div key={image.id || index} className="admin-repeater-card admin-repeater-card--gallery">
                <PreviewImage src={image.imageUrl} alt={image.alt || draft.business.name} />
                <div className="admin-form-grid">
                  <AdminField label="Imagem URL" error={validationErrors[`sections.gallery.${index}.imageUrl`]}>
                    <input
                      value={image.imageUrl || ''}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = {
                            ...section.items[index],
                            imageUrl: event.target.value,
                            imagePublicId: '',
                          };
                        });
                        return nextDraft;
                      })}
                      {...getInputState(validationErrors[`sections.gallery.${index}.imageUrl`])}
                    />
                  </AdminField>
                  <AdminField label="Alt">
                    <input
                      value={image.alt || ''}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = { ...section.items[index], alt: event.target.value };
                        });
                        return nextDraft;
                      })}
                    />
                  </AdminField>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploadingField(`gallery-${index}`);
                    await uploadImageAndPatch(file, onUpload, {
                      tenantSlug: draft.business.slug,
                      assetType: 'gallery',
                    }, (upload) =>
                      setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = {
                            ...section.items[index],
                            imageUrl: upload.url,
                            imagePublicId: upload.publicId || '',
                          };
                        });
                        return nextDraft;
                      }),
                    );
                    setUploadingField('');
                  }}
                />
                {uploadingField === `gallery-${index}` ? <small>Enviando foto...</small> : null}
                <div className="admin-inline-actions">
                  <Button
                    variant="secondary"
                    className="button--danger-tone"
                    onClick={() => setDraft((current) => {
                      const nextDraft = cloneDeep(current);
                      updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                        section.items = section.items.filter((_, itemIndex) => itemIndex !== index);
                      });
                      return nextDraft;
                    })}
                  >
                    Remover foto
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </section>
          </div>
        </Card>
        ) : null}

        {activeStep === 'settings' ? (
          <>
        <Card id="tenant-content" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Configuracoes</SectionEyebrow>
              <h2>SEO, tema e secoes</h2>
              <p>Controle visibilidade, mensagem institucional, cores e detalhes avancados do tenant.</p>
            </div>
          </div>

          <div className="admin-card-stack admin-card-stack--airy">
          <AdminField label="Texto Sobre nos">
            <textarea
              rows="4"
              value={aboutSection?.items?.[0]?.body || ''}
              onChange={(event) => setDraft((current) => {
                const nextDraft = cloneDeep(current);
                updateSectionDraft(nextDraft, 'about', 'custom', (section) => {
                  section.visible = Boolean(event.target.value);
                  section.description = '';
                  section.items = [{ id: 'about-1', body: event.target.value }];
                });
                return nextDraft;
              })}
            />
          </AdminField>

          <div className="admin-form-grid">
            <AdminField label="SEO title">
              <input
                value={draft.business.seo?.title || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    seo: { ...current.business.seo, title: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="SEO descricao">
              <input
                value={draft.business.seo?.description || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    seo: { ...current.business.seo, description: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <ThemeColorField
              label="Cor primaria"
              value={draft.theme.colors?.primary || '#f97316'}
              fallback="#f97316"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { primary: nextValue }),
              }))}
            />
            <ThemeColorField
              label="Cor secundaria"
              value={draft.theme.colors?.secondary || '#fb7185'}
              fallback="#fb7185"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { secondary: nextValue }),
              }))}
            />
            <ThemeColorField
              label="Fundo"
              value={draft.theme.colors?.background || '#140d09'}
              fallback="#140d09"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { background: nextValue }),
              }))}
            />
            <ThemeColorField
              label="Texto"
              value={draft.theme.colors?.text || '#fff8f2'}
              fallback="#fff8f2"
              onChange={(nextValue) => setDraft((current) => ({
                ...current,
                theme: buildDerivedTheme(current.theme, { text: nextValue }),
              }))}
            />
          </div>

          <div id="tenant-footer-signature" className="admin-subpanel admin-subpanel--highlight">
            <div className="admin-panel-card__header">
              <div>
                <h2>Assinatura do criador</h2>
                <p>Um rodape discreto para creditar a criacao do site e manter um contato rapido.</p>
              </div>
              <Button
                variant={ctaSection?.visible !== false ? 'primary' : 'secondary'}
                className="admin-toggle-button"
                onClick={() => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                    section.visible = section.visible === false;
                  });
                  return nextDraft;
                })}
              >
                {ctaSection?.visible !== false ? 'Assinatura visivel' : 'Assinatura oculta'}
              </Button>
            </div>

            <div className="admin-form-grid">
              <AdminField label="Titulo do rodape">
                <input
                  value={ctaSection?.title || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.title = event.target.value;
                    });
                    return nextDraft;
                  })}
                />
              </AdminField>
              <AdminField label="Legenda">
                <input
                  value={ctaSection?.settings?.eyebrow || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.settings = {
                        ...(section.settings || {}),
                        variant: section.settings?.variant || 'footer-signature',
                        eyebrow: event.target.value,
                      };
                    });
                    return nextDraft;
                  })}
                />
              </AdminField>
              <AdminField label="Label do botao">
                <input
                  value={ctaSection?.settings?.primaryAction?.label || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.settings = {
                        ...(section.settings || {}),
                        variant: section.settings?.variant || 'footer-signature',
                        primaryAction: {
                          ...(section.settings?.primaryAction || {}),
                          label: event.target.value,
                        },
                      };
                    });
                    return nextDraft;
                  })}
                />
              </AdminField>
              <AdminField label="Link do Instagram" error={validationErrors['cta.primaryAction.href']}>
                <input
                  value={ctaSection?.settings?.primaryAction?.href || ''}
                  onChange={(event) => setDraft((current) => {
                    const nextDraft = cloneDeep(current);
                    updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                      section.settings = {
                        ...(section.settings || {}),
                        variant: section.settings?.variant || 'footer-signature',
                        primaryAction: {
                          ...(section.settings?.primaryAction || {}),
                          href: event.target.value,
                        },
                      };
                    });
                    return nextDraft;
                  })}
                  {...getInputState(validationErrors['cta.primaryAction.href'])}
                />
              </AdminField>
            </div>

            <AdminField label="Texto complementar">
              <textarea
                rows="3"
                value={ctaSection?.description || ''}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                    section.description = event.target.value;
                  });
                  return nextDraft;
                })}
              />
            </AdminField>
          </div>

          <div className="admin-sections-list">
            {draft.sections
              .filter((section) => !HIDDEN_ADMIN_SECTION_KEYS.has(section.key))
              .map((section) => (
              <div key={section.key} className="admin-sections-list__item">
                <div className="admin-section-summary">
                  <strong>{getSectionDisplayLabel(section)}</strong>
                  <div className="admin-section-summary__meta">
                    <span className="admin-section-chip">{getSectionTypeLabel(section)}</span>
                    <span className="admin-section-chip admin-section-chip--muted">ID: {section.key}</span>
                  </div>
                </div>
                <div className="admin-sections-list__controls">
                  <Button
                    variant={section.visible !== false ? 'primary' : 'secondary'}
                    className="admin-toggle-button"
                    onClick={() => setDraft((current) => ({
                      ...current,
                      sections: current.sections.map((item) =>
                        item.key === section.key ? { ...item, visible: item.visible === false } : item,
                      ),
                    }))}
                  >
                    {section.visible !== false ? 'Visivel' : 'Oculta'}
                  </Button>
                  <label className="admin-section-order">
                    <span>Ordem</span>
                    <input
                      type="number"
                      value={section.order}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        sections: current.sections.map((item) =>
                          item.key === section.key ? { ...item, order: Number(event.target.value) } : item,
                        ),
                      }))}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          </div>
        </Card>

        <Card className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Historico</SectionEyebrow>
              <h2>Historico de alteracoes</h2>
              <p>Registro leve das ultimas mudancas salvas para este tenant.</p>
            </div>
            <span className="admin-section-chip admin-section-chip--accent">{historyEntries.length} item(ns)</span>
          </div>

          <div className="admin-event-list admin-event-list--scroll">
            {historyEntries.length ? (
              historyEntries.slice(0, 16).map((entry, index) => (
                <div key={`${entry.field}-${entry.changedAt || index}`} className="admin-event-item admin-event-item--analytics">
                  <div>
                    <span className="admin-section-chip admin-section-chip--muted">{entry.field}</span>
                    <strong>
                      {formatHistoryValue(entry.oldValue)} {'->'} {formatHistoryValue(entry.newValue)}
                    </strong>
                    <span>Mudanca registrada no ultimo salvamento disponivel.</span>
                  </div>
                  <time dateTime={entry.changedAt}>{formatAnalyticsTimestamp(entry.changedAt)}</time>
                </div>
              ))
            ) : (
              <p className="admin-muted-copy">Ainda nao existem alteracoes salvas para este tenant.</p>
            )}
          </div>
        </Card>

        <Card id="tenant-analytics" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <SectionEyebrow>Observabilidade</SectionEyebrow>
              <h2>Analytics do tenant</h2>
              <p>Mostre valor rapidamente com volume de acessos e interacoes.</p>
            </div>
          </div>

          <div className="admin-analytics-summary">
            <div className="admin-analytics-stat-card">
              <span>Total de eventos</span>
              <strong>{analyticsSummary?.totalEvents || 0}</strong>
              <small>Visao consolidada de todas as interacoes.</small>
            </div>
            <div className="admin-analytics-stat-card">
              <span>Ultimos 7 dias</span>
              <strong>{analyticsSummary?.last7DaysEvents || 0}</strong>
              <small>Movimento recente do tenant na ultima semana.</small>
            </div>
            <div className="admin-analytics-stat-card">
              <span>Tipos rastreados</span>
              <strong>{analyticsByEventType.length}</strong>
              <small>Quantos comportamentos diferentes o painel ja capturou.</small>
            </div>
            <div className="admin-analytics-stat-card">
              <span>Ultimo registro</span>
              <strong>{latestAnalyticsEvent ? formatAnalyticsTimestamp(latestAnalyticsEvent.occurredAt) : 'Sem eventos'}</strong>
              <small>{latestAnalyticsEvent ? getAnalyticsEventLabel(latestAnalyticsEvent.eventType) : 'Assim que chegar um evento ele aparece aqui.'}</small>
            </div>
          </div>

          <div className="admin-analytics-panels">
            <div className="admin-analytics-panel">
              <div className="admin-analytics-panel__header">
                <div>
                  <h3>Eventos por tipo</h3>
                  <p>Entenda o que o visitante faz com mais frequencia.</p>
                </div>
              </div>

              <div className="admin-ranked-list admin-ranked-list--scroll">
                {analyticsByEventType.map((item) => (
                  <div key={item.eventType} className="admin-ranked-item admin-ranked-item--analytics">
                    <div>
                      <span className="admin-section-chip admin-section-chip--accent">
                        {getAnalyticsEventLabel(item.eventType)}
                      </span>
                      <strong>{getAnalyticsEventLabel(item.eventType)}</strong>
                      <span>{item.count} evento(s) registrados.</span>
                    </div>
                    <div className="admin-ranked-item__meta">
                      <b>{item.count}</b>
                      <div className="admin-meter">
                        <span style={{ width: `${Math.max(10, (item.count / maxAnalyticsEventCount) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-analytics-panel">
              <div className="admin-analytics-panel__header">
                <div>
                  <h3>Timeline recente</h3>
                  <p>Ultimas acoes registradas para este tenant.</p>
                </div>
              </div>

              <div className="admin-event-list admin-event-list--scroll">
                {recentAnalyticsEvents.map((event) => (
                  <div key={event.id} className="admin-event-item admin-event-item--analytics">
                    <div>
                      <span className="admin-section-chip admin-section-chip--muted">
                        {getAnalyticsEventLabel(event.eventType)}
                      </span>
                      <strong>{getAnalyticsTargetSummary(event)}</strong>
                      <span>
                        {event.targetLabel || event.targetType || 'Sem alvo'}
                      </span>
                    </div>
                    <time dateTime={event.occurredAt}>{formatAnalyticsTimestamp(event.occurredAt)}</time>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

