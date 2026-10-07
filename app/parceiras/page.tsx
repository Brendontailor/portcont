'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import { api } from '@/services/api';
import type { Partner } from '@/types';
import { formatDateTime } from '@/utils/helpers';
import styles from './page.module.css';

export default function ParceirasPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    setError(null);
    try {
      const data = await api.partners.list(false);
      setPartners(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar parceiras');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) return;
    try {
      if (editingPartner) {
        await api.partners.update(editingPartner.id, { name: newPartnerName.trim() });
      } else {
        await api.partners.create(newPartnerName.trim());
      }
      setNewPartnerName('');
      setEditingPartner(null);
      setShowModal(false);
      await loadPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar parceira');
    }
  };

  const openCreateModal = () => {
    setEditingPartner(null);
    setNewPartnerName('');
    setShowModal(true);
  };

  const openRenameModal = (partner: Partner) => {
    setEditingPartner(partner);
    setNewPartnerName(partner.name);
    setShowModal(true);
  };

  const closePartnerModal = () => {
    setShowModal(false);
    setEditingPartner(null);
    setNewPartnerName('');
  };

  const handleToggleActive = async (partner: Partner) => {
    try {
      await api.partners.update(partner.id, { active: !partner.active });
      await loadPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar parceira');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Isso só é possível se não houver histórico.')) return;
    try {
      await api.partners.delete(id);
      await loadPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir parceira');
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <Header />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.loading}>
              <div className="loading-spinner" />
              <p>Carregando parceiras...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>Parceiras</h1>
            <button className={styles.newBtn} onClick={openCreateModal}>
              + Nova Parceira
            </button>
          </header>

          {error && (
            <div className={styles.error} role="alert">
              {error}
              <button onClick={() => setError(null)} className={styles.dismissBtn}>✕</button>
            </div>
          )}

          {partners.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyImage} aria-hidden="true">
                <Image
                  src="/images/portcont/portcont-parceiras-competencia.png"
                  alt=""
                  width={280}
                  height={200}
                  className={styles.emptyImageEl}
                />
              </div>
              <h2>Nenhuma parceira cadastrada</h2>
              <p>Crie a primeira parceira para começar a comparar bases.</p>
              <button className={styles.newBtn} onClick={openCreateModal}>
                + Criar Primeira Parceira
              </button>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className="table" role="table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Slug</th>
                    <th scope="col">Status</th>
                    <th scope="col">Competências</th>
                    <th scope="col">Última Comparação</th>
                    <th scope="col">Criada em</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map(partner => (
                    <tr key={partner.id}>
                      <td>
                        <Link href={`/parceiras/${partner.id}`} className={styles.partnerLink}>
                          {partner.name}
                        </Link>
                      </td>
                      <td className={styles.slug}>{partner.slug}</td>
                      <td>
                        <span className={`${styles.badge} ${partner.active ? styles.badgeActive : styles.badgeInactive}`}>
                          {partner.active ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td>{partner._count?.periods || 0}</td>
                      <td>
                        {partner.periods?.[0]?.comparisons?.[0]
                          ? <span className={styles.date}>{formatDateTime(partner.periods[0].comparisons[0].createdAt)}</span>
                          : '—'}
                      </td>
                      <td><span className={styles.date}>{formatDateTime(partner.createdAt)}</span></td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={styles.iconBtn}
                            onClick={() => openRenameModal(partner)}
                            aria-label={`Renomear ${partner.name}`}
                            title="Renomear parceira"
                          >
                            ✎
                          </button>
                          <button
                            className={styles.iconBtn}
                            onClick={() => handleToggleActive(partner)}
                            aria-label={partner.active ? 'Pausar parceira' : 'Ativar parceira'}
                            title={partner.active ? 'Pausar parceira' : 'Ativar parceira'}
                          >
                            {partner.active ? '⏸' : '▶'}
                          </button>
                          <button
                            className={styles.iconBtn}
                            onClick={() => handleDelete(partner.id)}
                            aria-label="Excluir"
                            title="Excluir parceira"
                            disabled={!!partner._count?.periods && partner._count.periods > 0}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showModal && (
            <div className={styles.modalOverlay} onClick={closePartnerModal}>
              <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <h2>{editingPartner ? 'Renomear Parceira' : 'Nova Parceira'}</h2>
                <form onSubmit={handleSavePartner}>
                  <label htmlFor="partnerName" className={styles.formLabel}>
                    Nome da Parceira
                  </label>
                  <input
                    id="partnerName"
                    type="text"
                    value={newPartnerName}
                    onChange={e => setNewPartnerName(e.target.value)}
                    placeholder="Ex: RG Sul, Holz"
                    className={styles.formInput}
                    autoFocus
                    required
                    maxLength={100}
                  />
                  <div className={styles.modalActions}>
                      <button type="button" className={styles.btnSecondary} onClick={closePartnerModal}>
                        Cancelar
                      </button>
                    <button type="submit" className={styles.btnPrimary}>
                      {editingPartner ? 'Salvar nome' : 'Criar'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
