import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Effect } from 'effect';
import * as D from './domain.ts';
import { LocalDemoRepository } from './storage.ts';
import type {
  FoodInput,
  PantryRecord,
  PantryRepository,
  PantryState,
  RestockInput
} from './types.ts';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { Stats } from './components/Stats.tsx';
import { Nav } from './components/Nav.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { ShoppingView } from './components/ShoppingView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { DialogModal, type ModalState } from './components/DialogModal.tsx';
import { Toast } from './components/Toast.tsx';

export const App: React.FC = () => {
  const [repository, setRepository] = useState<PantryRepository>(() => new LocalDemoRepository());
  const repositoryRef = useRef<PantryRepository>(repository);
  useEffect(() => {
    repositoryRef.current = repository;
  }, [repository]);

  const [data, setData] = useState<PantryRecord | null>(null);
  const dataRef = useRef<PantryRecord | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const [tab, setTab] = useState<'inventory' | 'shopping' | 'history'>('inventory');
  const [filter, setFilter] = useState<'all' | 'soon' | 'low'>('all');
  const [search, setSearch] = useState<string>('');
  const [location, setLocation] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<string>('category');

  const [busy, setBusy] = useState<boolean>(false);
  const busyRef = useRef<boolean>(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const [authCheck, setAuthCheck] = useState<boolean>(false);
  const [online, setOnline] = useState<boolean>(false);
  const onlineRef = useRef<boolean>(false);
  useEffect(() => {
    onlineRef.current = online;
  }, [online]);

  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState | null>(null);
  const modalRef = useRef<ModalState | null>(null);
  useEffect(() => {
    modalRef.current = modal;
  }, [modal]);

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (e.key === '/' && !modalRef.current) {
        const target = e.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (
          tagName !== 'input' &&
          tagName !== 'textarea' &&
          tagName !== 'select' &&
          !target?.isContentEditable
        ) {
          const searchInput = document.getElementById('search') as HTMLInputElement | null;
          if (searchInput && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, []);

  const pendingRemoteRef = useRef<PantryRecord | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const activateShared = useCallback(
    async (candidate: any) => {
      const loaded = await candidate.load();
      setRepository(candidate);
      setData(loaded);
      setOnline(true);

      candidate.subscribe(
        (next: PantryRecord) => {
          if (busyRef.current) {
            pendingRemoteRef.current = next;
          } else if (dataRef.current && next.revision > dataRef.current.revision) {
            setData(next);
            showToast('Pantry updated from your household');
          }
        },
        () => showToast('Connection interrupted. Reconnect before editing.')
      );

      setModal(null);
    },
    [showToast]
  );

  const resumeShared = useCallback(async () => {
    if (!window.PANTRY_CONFIG?.firebase?.apiKey) return;
    setAuthCheck(true);
    try {
      const { FirebaseRepository } = await import('./firebase.js');
      const candidate = await FirebaseRepository.resume(window.PANTRY_CONFIG);
      if (candidate) {
        await activateShared(candidate);
        showToast('Your shared pantry is ready');
      }
    } catch (error: any) {
      showToast(
        error.code === 'permission-denied'
          ? 'Your saved sign-in is not a member of this pantry. Check the household setup.'
          : 'Could not load your shared pantry. Check your connection, then choose Connect to retry.'
      );
    } finally {
      setAuthCheck(false);
    }
  }, [activateShared, showToast]);

  // Initial load
  useEffect(() => {
    const init = async () => {
      try {
        const loaded = await repositoryRef.current.load();
        setData(loaded);
        if (window.PANTRY_CONFIG?.firebase?.apiKey) {
          void resumeShared();
        }
      } catch (e: any) {
        setLoadError(e.message || 'Error loading pantry');
      }
    };
    init();
  }, [resumeShared]);

  // Storage synchronization between tabs
  useEffect(() => {
    const handleStorage = async () => {
      if (!onlineRef.current && !busyRef.current) {
        try {
          const loaded = await repositoryRef.current.load();
          setData(loaded);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const mutate = useCallback(
    async (fn: (s: PantryState) => void, message: string): Promise<void> => {
      if (busyRef.current) return;
      setBusy(true);

      const currentData = dataRef.current;
      const currentModal = modalRef.current;

      try {
        if (currentModal && currentData && currentModal.revision !== currentData.revision) {
          throw new Error(
            'Stock changed while this form was open. Close it and review the latest inventory.'
          );
        }

        if (!currentData) throw new Error('No pantry data available.');

        const program = Effect.gen(function* () {
          const next = structuredClone(currentData.state);
          fn(next);
          const saved: PantryRecord = yield* Effect.tryPromise({
            try: () => repositoryRef.current.save(next, currentData.revision),
            catch: (e) => e as Error
          });
          return saved;
        });

        const saved = await Effect.runPromise(program);
        setData(saved);
        setModal(null);
        showToast(message);
      } catch (err: any) {
        if (!currentModal) {
          showToast(err.message || 'An error occurred.');
        }
        throw err;
      } finally {
        setBusy(false);
        if (
          pendingRemoteRef.current &&
          dataRef.current &&
          pendingRemoteRef.current.revision > dataRef.current.revision
        ) {
          setData(pendingRemoteRef.current);
        }
        pendingRemoteRef.current = null;
      }
    },
    [showToast]
  );

  const handleExport = useCallback(() => {
    if (!data) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(data.state, null, 2)], { type: 'application/json' })
    );
    a.download = `pantry-${D.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, [data]);

  const handleImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const exit = Effect.runSyncExit(D.validateState(json));
        if (exit._tag === 'Failure') {
          showToast('Invalid backup file. Format not recognized.');
          return;
        }
        const validated = exit.value;
        await mutate((s) => {
          Object.assign(s, validated);
        }, 'Pantry restored from backup');
      } catch (err: any) {
        showToast(err.message || 'Could not import file.');
      }
    },
    [mutate, showToast]
  );

  const handleConnect = useCallback(async () => {
    setProfileOpen(false);
    if (online) {
      if (repositoryRef.current.signOut) {
        await repositoryRef.current.signOut();
      }
      window.location.reload();
      return;
    }
    if (!window.PANTRY_CONFIG?.firebase?.apiKey) {
      setModal({
        type: 'connect_missing',
        revision: dataRef.current?.revision ?? 0
      });
      return;
    }
    setModal({
      type: 'connect_auth',
      revision: dataRef.current?.revision ?? 0
    });
  }, [online]);

  const handleModalSubmit = useCallback(
    async (values: Record<string, any>) => {
      if (!modal) return;
      const { type, product: p, batch: b, shoppingItem: i } = modal;

      if (type === 'add') {
        await mutate((s) => {
          D.add(s, {
            name: values.name,
            unit: values.unit,
            category: values.category,
            location: values.location,
            quantity: Number(values.quantity),
            minimum: values.minimum !== undefined ? Number(values.minimum) : undefined,
            expiry: values.expiry || null
          } as FoodInput);
        }, 'Food added');
        return;
      }

      if (type === 'use' && b) {
        await mutate((s) => {
          D.move(s, b.id, values.type || 'correct', Number(values.quantity));
        }, 'Stock updated');
        return;
      }

      if (type === 'minimum' && p) {
        await mutate((s) => {
          const n = Number(values.quantity);
          if (!Number.isFinite(n) || n < 0) throw new Error('Enter zero or more.');
          const prod = s.products.find((prod) => prod.id === p.id);
          if (prod) {
            prod.minimum = n;
            prod.category = values.category.trim();
          }
        }, 'Minimum saved');
        return;
      }

      if (type === 'restock' && p) {
        await mutate((s) => {
          const item = s.shopping.find((it) => it.productId === p.id && it.status === 'open');
          if (item) {
            D.purchase(s, item.id, {
              ...values,
              quantity: Number(values.quantity)
            } as any);
          } else {
            D.add(s, {
              ...p,
              ...values,
              location: (values.location || 'Pantry') as any,
              quantity: Number(values.quantity)
            } as FoodInput);
          }
        }, 'Stock added');
        return;
      }

      if (type === 'buy' && i && p) {
        await mutate((s) => {
          D.purchase(s, i.id, {
            ...values,
            quantity: Number(values.quantity)
          } as any);
        }, 'Restocked and checked off');
        return;
      }

      if (type === 'delete' && p) {
        await mutate((s) => {
          D.deleteFood(s, p.id);
        }, `${p.name} deleted`);
        return;
      }

      if (type === 'bulk') {
        await mutate((s) => {
          const entries: RestockInput[] = s.products
            .filter((prod) => values[`picked-${prod.id}`])
            .map((prod) => ({
              productId: prod.id,
              quantity: Number(values[`quantity-${prod.id}`]),
              location: values[`location-${prod.id}`],
              expiry: values[`expiry-${prod.id}`] || null
            }));
          D.bulkRestock(s, entries);
        }, 'Selected foods restocked');
        return;
      }

      if (type === 'connect_missing') {
        setModal(null);
        return;
      }

      if (type === 'connect_auth') {
        const { FirebaseRepository } = await import('./firebase.js');
        const candidate = await FirebaseRepository.connect(window.PANTRY_CONFIG!, {
          email: values.email,
          password: values.password
        });
        await activateShared(candidate);
        showToast('Connected to shared pantry');
      }
    },
    [modal, mutate, activateShared, showToast]
  );

  const soon = useMemo(() => {
    if (!data) return [];
    return data.state.batches.filter((b) => b.quantity > 0 && D.expiryDays(b.expiry) <= 3);
  }, [data]);

  const low = useMemo(() => {
    if (!data) return [];
    return data.state.products.filter((p) => D.isLow(data.state, p));
  }, [data]);

  const openShopping = useMemo(() => {
    if (!data) return [];
    return data.state.shopping.filter((i) => i.status === 'open');
  }, [data]);

  if (loadError) {
    return (
      <main>
        <h1>We couldn’t open your pantry</h1>
        <p>{loadError}</p>
      </main>
    );
  }

  if (!data) {
    return null;
  }

  const s = data.state;

  return (
    <>
      <Header
        online={online}
        authCheck={authCheck}
        profileOpen={profileOpen}
        onToggleProfile={() => setProfileOpen((prev) => !prev)}
        onCloseProfile={() => setProfileOpen(false)}
        onExport={handleExport}
        onImport={handleImport}
        onConnect={handleConnect}
      />

      <main>
        <Hero
          hasProducts={s.products.length > 0}
          onAdd={() =>
            setModal({
              type: 'add',
              revision: data.revision
            })
          }
          onBulk={() =>
            setModal({
              type: 'bulk',
              revision: data.revision
            })
          }
        />

        <Stats
          totalProducts={s.products.length}
          soonCount={soon.length}
          lowCount={low.length}
          currentFilter={filter}
          onSelectFilter={(newFilter) => {
            setFilter(newFilter);
            setTab('inventory');
          }}
        />

        <Nav
          tab={tab}
          shoppingCount={openShopping.length}
          onSelectTab={(newTab) => setTab(newTab)}
        />

        <div id="content">
          {tab === 'inventory' && (
            <InventoryView
              state={s}
              online={online}
              search={search}
              location={location}
              category={category}
              sort={sort}
              filter={filter}
              onSearchChange={setSearch}
              onLocationChange={setLocation}
              onCategoryChange={setCategory}
              onSortChange={setSort}
              onClearFilter={() => setFilter('all')}
              onAddFood={() =>
                setModal({
                  type: 'add',
                  revision: data.revision
                })
              }
              onTrySample={async () => {
                await mutate((st) => {
                  Object.assign(st, D.demo());
                }, 'Sample pantry ready');
              }}
              onCheckStock={(batch, product) =>
                setModal({
                  type: 'use',
                  revision: data.revision,
                  product,
                  batch
                })
              }
              onRestock={(product) =>
                setModal({
                  type: 'restock',
                  revision: data.revision,
                  product
                })
              }
              onEditSettings={(product) =>
                setModal({
                  type: 'minimum',
                  revision: data.revision,
                  product
                })
              }
              onDelete={(product) =>
                setModal({
                  type: 'delete',
                  revision: data.revision,
                  product
                })
              }
              onAddToList={async (product) => {
                await mutate((st) => {
                  const prod = st.products.find((p) => p.id === product.id);
                  if (prod) D.suggest(st, prod);
                }, 'Added to your list');
              }}
            />
          )}

          {tab === 'shopping' && (
            <ShoppingView
              state={s}
              onRemoveItem={async (itemId) => {
                await mutate((st) => {
                  const it = st.shopping.find((item) => item.id === itemId);
                  if (it) it.status = 'removed';
                }, 'Removed from list');
              }}
              onBuyItem={(item, product) =>
                setModal({
                  type: 'buy',
                  revision: data.revision,
                  product,
                  shoppingItem: item
                })
              }
              onAddSuggestion={async (product) => {
                await mutate((st) => {
                  const prod = st.products.find((p) => p.id === product.id);
                  if (prod) D.suggest(st, prod);
                }, 'Added to your list');
              }}
            />
          )}

          {tab === 'history' && <HistoryView state={s} />}
        </div>

        <div className="footer">
          <span>
            {online ? 'Shared with your household' : 'Your demo stays on this device'} ·{' '}
            {s.batches.filter((b) => b.quantity > 0).length} active batches
          </span>
          <span>Update what’s left whenever you check.</span>
        </div>
      </main>

      <DialogModal
        modal={modal}
        state={s}
        onClose={() => setModal(null)}
        onSubmit={handleModalSubmit}
      />

      <Toast message={toastMessage} onClear={() => setToastMessage(null)} />
    </>
  );
};
