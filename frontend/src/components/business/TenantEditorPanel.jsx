import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/common/Button.jsx';
import { Card } from '@/components/common/Card.jsx';
import { EmptyState } from '@/components/common/EmptyState.jsx';

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureSection(draft, key, fallbackType = 'custom') {
  const existing = draft.sections.find((section) => section.key === key);

  if (existing) {
    return existing;
  }

  const nextSection = {
    id: key,
    key,
    type: fallbackType,
    title: '',
    description: '',
    order: draft.sections.length + 1,
    visible: false,
    variant: '',
    settings: {},
    items: [],
  };

  draft.sections = [...draft.sections, nextSection];
  return nextSection;
}

function updateSectionDraft(draft, key, fallbackType, updater) {
  const section = ensureSection(draft, key, fallbackType);
  updater(section);
}

function newLinkItem() {
  return {
    id: `link-${Date.now()}`,
    type: 'external',
    group: 'primary',
    label: '',
    subtitle: '',
    icon: 'default',
    url: '',
    value: '',
    visible: true,
    order: Date.now(),
    target: '_blank',
    metadata: {},
  };
}

function newServiceItem() {
  return {
    id: `service-${Date.now()}`,
    name: '',
    description: '',
    price: 0,
    ctaLabel: 'Gerar QR PIX',
  };
}

function newGalleryItem() {
  return {
    id: `gallery-${Date.now()}`,
    imageUrl: '',
    alt: '',
  };
}

function AdminField({ label, children, description }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
      {description ? <small>{description}</small> : null}
    </label>
  );
}

function PreviewImage({ src, alt }) {
  if (!src) {
    return <div className="admin-image-preview admin-image-preview--empty">Sem imagem</div>;
  }

  return (
    <div className="admin-image-preview">
      <img src={src} alt={alt} />
    </div>
  );
}

async function uploadImageAndPatch(file, onUpload, onDone) {
  if (!file || !onUpload) {
    return;
  }

  const upload = await onUpload(file);
  onDone(upload.url);
}

export function TenantEditorPanel({
  editor,
  saving,
  deleting,
  onSave,
  onDelete,
  onUpload,
}) {
  const [draft, setDraft] = useState(editor ? cloneDeep(editor) : null);
  const [uploadingField, setUploadingField] = useState('');

  useEffect(() => {
    setDraft(editor ? cloneDeep(editor) : null);
  }, [editor]);

  const analyticsSummary = useMemo(() => draft?.analytics || null, [draft]);

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
  const quickLinks = [
    { href: '#tenant-identity', label: 'Identidade' },
    { href: '#tenant-media', label: 'Midia' },
    { href: '#tenant-operations', label: 'Operacao' },
    { href: '#tenant-links', label: 'Acessos' },
    { href: '#tenant-content', label: 'Conteudo' },
    { href: '#tenant-analytics', label: 'Analytics' },
  ];

  const handleSave = async () => {
    await onSave?.(draft);
  };

  return (
    <div className="admin-editor-stack">
      <Card className="admin-panel-card admin-panel-card--hero">
        <div className="admin-editor-header">
          <div>
            <h2>{draft.business.name}</h2>
            <p>/site/{draft.business.slug}</p>
            <div className="admin-editor-meta">
              <span className="admin-meta-pill">Status: {draft.business.status}</span>
              <span className="admin-meta-pill">Tag: {draft.nfcTag?.code || 'Sem codigo NFC'}</span>
              <span className="admin-meta-pill">Eventos: {analyticsSummary?.totalEvents || 0}</span>
            </div>
          </div>
          <div className="admin-editor-actions">
            <Button variant="secondary" className="button--danger-tone" onClick={() => onDelete?.(draft.business.id)} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir tenant'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alteracoes'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="admin-editor-quicknav">
        {quickLinks.map((link) => (
          <Button key={link.href} href={link.href} variant="secondary" className="admin-quicklink">
            {link.label}
          </Button>
        ))}
      </div>

      <div className="admin-editor-grid">
        <Card id="tenant-identity" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Identidade do tenant</h2>
              <p>Dados basicos, slug, status e apresentacao da pagina.</p>
            </div>
          </div>

          <div className="admin-form-grid">
            <AdminField label="Nome do comercio">
              <input
                value={draft.business.name}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, name: event.target.value },
                }))}
              />
            </AdminField>
            <AdminField label="Slug publico">
              <input
                value={draft.business.slug}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: { ...current.business, slug: event.target.value },
                }))}
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
            <AdminField label="Codigo da tag NFC">
              <input
                value={draft.nfcTag?.code || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  nfcTag: { ...(current.nfcTag || {}), code: event.target.value, status: current.nfcTag?.status || 'active' },
                }))}
              />
            </AdminField>
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
        </Card>

        <Card id="tenant-media" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Logo, banner e uploads</h2>
              <p>Suba imagens agora em armazenamento local preparado para trocar por cloud depois.</p>
            </div>
          </div>

          <div className="admin-media-grid">
            <div className="admin-media-card">
              <PreviewImage src={draft.business.logoUrl} alt={draft.business.name} />
              <AdminField label="Logo URL">
                <input
                  value={draft.business.logoUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: { ...current.business, logoUrl: event.target.value },
                  }))}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('logo');
                  await uploadImageAndPatch(file, onUpload, (url) =>
                    setDraft((current) => ({
                      ...current,
                      business: { ...current.business, logoUrl: url },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'logo' ? <small>Enviando logo...</small> : null}
            </div>

            <div className="admin-media-card">
              <PreviewImage src={draft.business.bannerUrl} alt={draft.business.name} />
              <AdminField label="Banner URL">
                <input
                  value={draft.business.bannerUrl || ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    business: { ...current.business, bannerUrl: event.target.value },
                  }))}
                />
              </AdminField>
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadingField('banner');
                  await uploadImageAndPatch(file, onUpload, (url) =>
                    setDraft((current) => ({
                      ...current,
                      business: { ...current.business, bannerUrl: url },
                    })),
                  );
                  setUploadingField('');
                }}
              />
              {uploadingField === 'banner' ? <small>Enviando banner...</small> : null}
            </div>
          </div>
        </Card>

        <Card id="tenant-operations" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <h2>Contato, localizacao e pagamentos</h2>
              <p>Campos operacionais do tenant e das conveniencias da pagina.</p>
            </div>
          </div>

          <div className="admin-form-grid">
            <AdminField label="WhatsApp">
              <input
                value={draft.business.contact?.whatsapp || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    contact: { ...current.business.contact, whatsapp: event.target.value },
                  },
                }))}
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
            <AdminField label="Mapa URL">
              <input
                value={draft.business.address?.mapUrl || ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  business: {
                    ...current.business,
                    address: { ...current.business.address, mapUrl: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Horario principal" description="Use o bloco de horarios do editor para detalhar mais linhas.">
              <input
                value={draft.business.hours?.[0]?.value || ''}
                onChange={(event) => setDraft((current) => {
                  const hours = current.business.hours?.length ? [...current.business.hours] : [{ id: 'weekday', label: 'Horario', value: '' }];
                  hours[0] = { ...hours[0], value: event.target.value };
                  return {
                    ...current,
                    business: { ...current.business, hours },
                  };
                })}
              />
            </AdminField>
          </div>

          <div className="admin-split-grid">
            <div className="admin-subpanel">
              <h3>Wi-Fi</h3>
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
                <AdminField label="Senha">
                  <input
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
                  />
                </AdminField>
              </div>
            </div>

            <div className="admin-subpanel">
              <h3>PIX</h3>
              <div className="admin-form-grid">
                <AdminField label="Tipo de chave">
                  <input
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
                  />
                </AdminField>
                <AdminField label="Chave PIX">
                  <input
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
                  />
                </AdminField>
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
          </div>
        </Card>

        <Card id="tenant-links" className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Links e atalhos</h2>
              <p>Edite os botoes de acesso rapido e outros links agrupados do tenant.</p>
            </div>
            <Button variant="secondary" onClick={() => setDraft((current) => ({ ...current, links: [...current.links, newLinkItem()] }))}>
              Adicionar link
            </Button>
          </div>

          <div className="admin-repeater-list">
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
                      <option value="external">external</option>
                      <option value="contact">contact</option>
                      <option value="social">social</option>
                      <option value="wifi">wifi</option>
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
                  <AdminField label="URL">
                    <input
                      value={link.url || ''}
                      onChange={(event) => setDraft((current) => {
                        const links = [...current.links];
                        links[index] = { ...links[index], url: event.target.value };
                        return { ...current, links };
                      })}
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
        </Card>

        <Card className="admin-panel-card">
          <div className="admin-panel-card__header">
            <div>
              <h2>Servicos e galeria</h2>
              <p>Conteudo principal da pagina publica do negocio.</p>
            </div>
          </div>

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

          <div className="admin-repeater-list">
            {(servicesSection?.items || []).map((service, index) => (
              <div key={service.id || index} className="admin-repeater-card">
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

          <div className="admin-repeater-list">
            {(gallerySection?.items || []).map((image, index) => (
              <div key={image.id || index} className="admin-repeater-card">
                <PreviewImage src={image.imageUrl} alt={image.alt || draft.business.name} />
                <div className="admin-form-grid">
                  <AdminField label="Imagem URL">
                    <input
                      value={image.imageUrl || ''}
                      onChange={(event) => setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = { ...section.items[index], imageUrl: event.target.value };
                        });
                        return nextDraft;
                      })}
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
                    await uploadImageAndPatch(file, onUpload, (url) =>
                      setDraft((current) => {
                        const nextDraft = cloneDeep(current);
                        updateSectionDraft(nextDraft, 'gallery', 'gallery', (section) => {
                          section.items[index] = { ...section.items[index], imageUrl: url };
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
        </Card>

        <Card id="tenant-content" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <h2>Conteudo, SEO e secoes</h2>
              <p>Controle visibilidade, mensagem institucional, CTA final e cores do tenant.</p>
            </div>
          </div>

          <AdminField label="Texto Sobre nos">
            <textarea
              rows="4"
              value={aboutSection?.items?.[0]?.body || ''}
              onChange={(event) => setDraft((current) => {
                const nextDraft = cloneDeep(current);
                updateSectionDraft(nextDraft, 'about', 'custom', (section) => {
                  section.visible = Boolean(event.target.value);
                  section.items = [{ id: 'about-1', body: event.target.value }];
                });
                return nextDraft;
              })}
            />
          </AdminField>

          <div className="admin-form-grid">
            <AdminField label="CTA primario">
              <input
                value={ctaSection?.settings?.primaryAction?.label || ''}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                    section.settings = {
                      ...(section.settings || {}),
                      primaryAction: {
                        ...(section.settings?.primaryAction || {}),
                        label: event.target.value,
                        href: section.settings?.primaryAction?.href || '',
                      },
                    };
                  });
                  return nextDraft;
                })}
              />
            </AdminField>
            <AdminField label="CTA primario URL">
              <input
                value={ctaSection?.settings?.primaryAction?.href || ''}
                onChange={(event) => setDraft((current) => {
                  const nextDraft = cloneDeep(current);
                  updateSectionDraft(nextDraft, 'cta', 'cta', (section) => {
                    section.settings = {
                      ...(section.settings || {}),
                      primaryAction: {
                        ...(section.settings?.primaryAction || {}),
                        label: section.settings?.primaryAction?.label || '',
                        href: event.target.value,
                      },
                    };
                  });
                  return nextDraft;
                })}
              />
            </AdminField>
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
            <AdminField label="Cor primaria">
              <input
                type="color"
                value={draft.theme.colors?.primary || '#f97316'}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    colors: { ...current.theme.colors, primary: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Cor secundaria">
              <input
                type="color"
                value={draft.theme.colors?.secondary || '#fb7185'}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    colors: { ...current.theme.colors, secondary: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Fundo">
              <input
                type="color"
                value={draft.theme.colors?.background || '#140d09'}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    colors: { ...current.theme.colors, background: event.target.value },
                  },
                }))}
              />
            </AdminField>
            <AdminField label="Texto">
              <input
                type="color"
                value={draft.theme.colors?.text || '#fff8f2'}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  theme: {
                    ...current.theme,
                    colors: { ...current.theme.colors, text: event.target.value },
                  },
                }))}
              />
            </AdminField>
          </div>

          <div className="admin-sections-list">
            {draft.sections.map((section) => (
              <div key={section.key} className="admin-sections-list__item">
                <div>
                  <strong>{section.key}</strong>
                  <span>{section.type}</span>
                </div>
                <div className="admin-sections-list__controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={section.visible !== false}
                      onChange={(event) => setDraft((current) => ({
                        ...current,
                        sections: current.sections.map((item) =>
                          item.key === section.key ? { ...item, visible: event.target.checked } : item,
                        ),
                      }))}
                    />
                    visivel
                  </label>
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
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card id="tenant-analytics" className="admin-panel-card admin-panel-card--span-2">
          <div className="admin-panel-card__header">
            <div>
              <h2>Analytics do tenant</h2>
              <p>Mostre valor rapidamente com volume de acessos e interacoes.</p>
            </div>
          </div>

          <div className="admin-mini-stats">
            <div>
              <span>Total de eventos</span>
              <strong>{analyticsSummary?.totalEvents || 0}</strong>
            </div>
            <div>
              <span>Ultimos 7 dias</span>
              <strong>{analyticsSummary?.last7DaysEvents || 0}</strong>
            </div>
          </div>

          <div className="admin-ranked-list">
            {(analyticsSummary?.byEventType || []).map((item) => (
              <div key={item.eventType} className="admin-ranked-item">
                <div>
                  <strong>{item.eventType}</strong>
                </div>
                <b>{item.count}</b>
              </div>
            ))}
          </div>

          <div className="admin-event-list">
            {(analyticsSummary?.recentEvents || []).map((event) => (
              <div key={event.id} className="admin-event-item">
                <div>
                  <strong>{event.eventType}</strong>
                  <span>{event.targetLabel || event.targetType || 'Sem alvo'}</span>
                </div>
                <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('pt-BR')}</time>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
