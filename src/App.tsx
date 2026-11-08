import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Effect } from 'effect';
import * as D from './domain.ts';
import { requestCategorySuggestions } from './category-suggestions.ts';
import { LocalDemoRepository } from './storage.ts';
import type {
  FoodInput,
  Location,
  PantryRecord,
  PantryRepository,
  PantryState,
  RestockInput,
  CategorySuggestionInput,
  CategorySuggestion,
  CategoryAssignment
} from './types.ts';
import { Header } from './components/Header.tsx';
import { Hero } from './components/Hero.tsx';
import { Stats } from './components/Stats.tsx';
import { Nav } from './components/Nav.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { ShoppingView } from './components/ShoppingView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { DialogModal, type ModalState } from './components/DialogModal.tsx';
import {
  CategoryReviewDialog,
  type CategoryReviewData
} from './components/CategoryReviewDialog.tsx';
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
  const [categoryReview, setCategoryReview] = useState<CategoryReviewData | null>(null);
  const [suggestingCategories, setSuggestingCategories] = useState(false);

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
      // Update the refs before rendering the shared state so immediately
      // available actions (including Jev) cannot read the previous demo repo.
      repositoryRef.current = candidate;
      dataRef.current = loaded;
      onlineRef.current = true;
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
    async (
      fn: (s: PantryState) => void,
      message: string,
      expectedRevision?: number,
      keepEditorOpen = false
    ): Promise<PantryRecord | undefined> => {
      if (busyRef.current) return;
      busyRef.current = true;
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
        if (expectedRevision !== undefined && currentData.revision !== expectedRevision) {
          throw new Error(
            'Pantry changed while you reviewed these suggestions. Close this review and request fresh suggestions.'
          );
        }

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
        dataRef.current = saved;
        setData(saved);
        if (!keepEditorOpen) setModal(null);
        showToast(message);
        return saved;
      } catch (err: any) {
        if (!currentModal && expectedRevision === undefined) {
          showToast(err.message || 'An error occurred.');
        }
        throw err;
      } finally {
        busyRef.current = false;
        setBusy(false);
        if (
          pendingRemoteRef.current &&
          dataRef.current &&
          pendingRemoteRef.current.revision > dataRef.current.revision
        ) {
          dataRef.current = pendingRemoteRef.current;
          setData(pendingRemoteRef.current);
        }
        pendingRemoteRef.current = null;
      }
    },
    [showToast]
  );

  const requestSuggestions = useCallback(
    async (
      items: CategorySuggestionInput[],
      categories: string[],
      signal?: AbortSignal
    ): Promise<CategorySuggestion[]> => {
      if (!onlineRef.current) {
        throw new Error('Connect your shared pantry to get Jev category suggestions.');
      }
      const getIdToken = repositoryRef.current.getIdToken;
      if (!getIdToken) throw new Error('Sign in to get Jev category suggestions.');
      const token = await getIdToken.call(repositoryRef.current);
      return requestCategorySuggestions(token, items, categories, signal);
    },
    []
  );

  const suggestNewItemCategory = useCallback(
    async (name: string, categories: string[], signal: AbortSignal) => {
      const [suggestion] = await requestSuggestions([{ id: 'new-item', name }], categories, signal);
      if (!suggestion) throw new Error('No category suggestion was returned.');
      return suggestion;
    },
    [requestSuggestions]
  );

  const handleSuggestPantryCategories = useCallback(async () => {
    const snapshot = dataRef.current;
    if (!snapshot?.state.products.length || suggestingCategories) return;
    if (!onlineRef.current) {
      showToast('Connect your shared pantry to get Jev category suggestions.');
      return;
    }
    const categories = [
      ...new Set([...D.categories, ...snapshot.state.products.map((p) => p.category)])
    ].sort();

    setSuggestingCategories(true);
    try {
      const proposals: CategoryReviewData['entries'] = [];
      const products = snapshot.state.products;
      for (let index = 0; index < products.length; index += 10) {
        const batch = products.slice(index, index + 10);
        const results = await requestSuggestions(
          batch.map((product) => ({ id: product.id, name: product.name })),
          categories
        );
        if (dataRef.current?.revision !== snapshot.revision) {
          throw new Error(
            'Pantry changed while suggestions were being prepared. Refresh and try again.'
          );
        }
        for (const result of results) {
          const product = batch.find((candidate) => candidate.id === result.id);
          if (product && result.category !== product.category) {
            proposals.push({
              id: product.id,
              name: product.name,
              currentCategory: product.category,
              category: result.category,
              confidence: result.confidence
            });
          }
        }
      }
      if (dataRef.current?.revision !== snapshot.revision) {
        throw new Error(
          'Pantry changed while suggestions were being prepared. Refresh and try again.'
        );
      }
      if (!proposals.length) {
        showToast('Jev found no category changes to review.');
        return;
      }
      setCategoryReview({
        reviewId: crypto.randomUUID(),
        revision: snapshot.revision,
        categories,
        entries: proposals
      });
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Category suggestions are temporarily unavailable. You can still edit categories manually.'
      );
    } finally {
      setSuggestingCategories(false);
    }
  }, [requestSuggestions, showToast, suggestingCategories]);

  const applyCategoryAssignments = useCallback(
    async (assignments: CategoryAssignment[]) => {
      const review = categoryReview;
      if (!review) return;
      await mutate(
        (state) => D.applyCategorySuggestions(state, assignments),
        `${assignments.length} categories updated`,
        review.revision
      );
      setCategoryReview(null);
    },
    [categoryReview, mutate]
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

  const openAddFood = useCallback(
    (initialName = '') => {
      const snapshot = dataRef.current;
      if (!snapshot) return;
      setModal({
        type: 'add',
        revision: snapshot.revision,
        initialName,
        initialCategory: category === 'all' ? 'Other' : category,
        initialLocation: D.locations.includes(location as Location)
          ? (location as Location)
          : 'Pantry'
      });
    },
    [category, location]
  );

  const handleModalSubmit = useCallback(
    async (values: Record<string, any>) => {
      if (!modal) return;
      const { type, product: p, batch: b } = modal;

      if (type === 'add') {
        const keepAdding = values['add-action'] === 'another';
        const saved = await mutate(
          (s) => {
            D.add(s, {
              name: values.name,
              unit: values.unit,
              category: values.category,
              location: values.location,
              quantity: Number(values.quantity),
              minimum: values.minimum !== undefined ? Number(values.minimum) : undefined,
              expiry: values.expiry || null
            } as FoodInput);
          },
          `${String(values.name).trim()} added`,
          undefined,
          keepAdding
        );
        if (!saved) return;
        setTab('inventory');
        setSearch('');
        setCategory('all');
        setLocation('all');
        setFilter('all');
        if (keepAdding && modalRef.current === modal) {
          setModal({
            type: 'add',
            revision: dataRef.current?.revision ?? saved.revision,
            initialCategory: String(values.category),
            initialLocation: values.location as Location,
            lastAdded: String(values.name).trim()
          });
        }
        return;
      }

      if (type === 'manage' && p && !values['stock-action']) {
        const action = String(values['manage-action'] || 'save');
        if (action === 'delete') {
          await mutate((s) => {
            D.deleteFood(s, p.id);
          }, `${p.name} deleted`);
          return;
        }

        const name = String(values.name || '').trim();
        const category = String(values.category || '').trim();
        const unit = String(values.unit || '');
        const minimum = unit === 'level' ? 0.25 : Number(values.minimum);
        if (!name || name.length > 80) throw new Error('Enter a food name (up to 80 characters).');
        if (!D.units.includes(unit as (typeof D.units)[number]))
          throw new Error('Choose a valid tracking unit.');
        if (!category || category.length > 60)
          throw new Error('Enter a category name up to 60 characters.');
        if (!Number.isFinite(minimum) || minimum < 0)
          throw new Error('Minimum stock cannot be negative.');

        await mutate((s) => {
          const product = s.products.find((item) => item.id === p.id);
          if (!product) throw new Error('This item no longer exists.');
          const duplicate = s.products.find(
            (item) =>
              item.id !== product.id &&
              item.unit === unit &&
              item.name.toLowerCase() === name.toLowerCase()
          );
          if (duplicate) throw new Error('Another item already uses that name and tracking unit.');

          product.name = name;
          product.category = category;
          product.unit = unit as (typeof D.units)[number];
          product.minimum = minimum;

          const productBatches = s.batches.filter((batch) => batch.productId === p.id);
          for (const batch of productBatches) {
            const amount = Number(values[`quantity-${batch.id}`]);
            if (!Number.isFinite(amount) || amount < 0)
              throw new Error(`Enter a valid amount for ${batch.location}.`);
            if (unit === 'level' && ![0, 0.25, 0.5, 1].includes(amount))
              throw new Error(`Choose a valid rough level for ${batch.location}.`);
            const location = String(values[`location-${batch.id}`] || '');
            if (!D.locations.includes(location as (typeof D.locations)[number]))
              throw new Error('Choose a valid stock location.');
            const expiry = String(values[`expiry-${batch.id}`] || '') || null;
            if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry))
              throw new Error('Choose a valid package date.');
            if (
              amount !== batch.quantity ||
              (modal.section === 'stock' && modal.batch?.id === batch.id)
            ) {
              D.move(s, batch.id, 'correct', amount);
            }
            const savedBatch = s.batches.find((item) => item.id === batch.id)!;
            savedBatch.location = location as (typeof D.locations)[number];
            savedBatch.expiry = expiry;
          }
        }, 'Item updated');
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

      if ((type === 'stock' || type === 'restock' || type === 'buy' || type === 'manage') && p) {
        const action = String(values['stock-action']);
        await mutate(
          (s) => {
            const product = s.products.find((item) => item.id === p.id);
            if (!product) throw new Error('This food no longer exists.');
            if (action === 'update') {
              const batches = s.batches.filter(
                (batch) => batch.productId === p.id && values[`quantity-${batch.id}`] !== undefined
              );
              if (!batches.length) throw new Error('Choose a stock batch to update.');
              for (const batch of batches) {
                const raw = String(values[`quantity-${batch.id}`]).trim();
                const quantity = Number(raw);
                if (
                  !raw ||
                  !Number.isFinite(quantity) ||
                  quantity < 0 ||
                  (product.unit === 'level' && ![0, 0.25, 0.5, 1].includes(quantity))
                )
                  throw new Error('Enter a valid amount left.');
                const location = String(values[`location-${batch.id}`]);
                const expiry = String(values[`expiry-${batch.id}`] || '') || null;
                if (!D.locations.includes(location as (typeof D.locations)[number]))
                  throw new Error('Choose a valid location.');
                if (expiry && !/^\d{4}-\d{2}-\d{2}$/.test(expiry))
                  throw new Error('Choose a valid package date.');
                D.move(s, batch.id, 'correct', quantity);
                batch.location = location as (typeof D.locations)[number];
                batch.expiry = expiry;
              }
            } else if (action === 'restock') {
              const quantity = Number(values.quantity);
              if (
                !Number.isFinite(quantity) ||
                quantity <= 0 ||
                (product.unit === 'level' && ![0.25, 0.5, 1].includes(quantity))
              )
                throw new Error('Enter an amount greater than zero.');
              const input = { quantity, location: values.location, expiry: values.expiry || null };
              const item = s.shopping.find(
                (entry) => entry.productId === p.id && entry.status === 'open'
              );
              if (item) D.purchase(s, item.id, input);
              else D.add(s, { ...product, ...input } as FoodInput);
            } else throw new Error('Choose a stock action.');
          },
          action === 'update' ? 'Stock updated' : 'Restocked and saved'
        );
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
    const ids = new Set(
      data.state.batches
        .filter((batch) => batch.quantity > 0 && D.expiryDays(batch.expiry) <= 3)
        .map((batch) => batch.productId)
    );
    return data.state.products.filter((product) => ids.has(product.id));
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
      <a className="skip-link" href="#main-content">
        Skip to pantry
      </a>
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

      <div className="app-workspace">
        <aside className="workspace-nav">
          <Nav
            tab={tab}
            shoppingCount={openShopping.length}
            onSelectTab={(newTab) => setTab(newTab)}
          />
          <p className="workspace-note">
            A place for everything
            <br />
            you have at home.
          </p>
        </aside>
        <main id="main-content" tabIndex={-1}>
          <Hero
            view={tab}
            hasProducts={s.products.length > 0}
            canSuggestCategories={online}
            suggestingCategories={suggestingCategories}
            onSuggestCategories={handleSuggestPantryCategories}
            onAdd={() => openAddFood()}
            onBulk={() =>
              setModal({
                type: 'bulk',
                revision: data.revision
              })
            }
          />

          {tab === 'inventory' && (
            <Stats
              totalProducts={s.products.length}
              soonCount={soon.length}
              lowCount={low.length}
              currentFilter={filter}
              onSelectFilter={(newFilter) => {
                setFilter(newFilter);
                setSearch('');
                setCategory('all');
                setLocation('all');
                setTab('inventory');
              }}
            />
          )}

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
                onAddFood={openAddFood}
                onTrySample={async () => {
                  await mutate((st) => {
                    Object.assign(st, D.demo());
                  }, 'Sample pantry ready');
                }}
                onUpdate={(product, batch) =>
                  setModal({ type: 'stock', revision: data.revision, product, batch })
                }
                onManage={(product, section, batch) =>
                  setModal({
                    type: 'manage',
                    revision: data.revision,
                    product,
                    section,
                    batch
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
                onAddSuggestions={async (productIds) => {
                  await mutate((st) => {
                    for (const id of productIds) {
                      const product = st.products.find((item) => item.id === id);
                      if (product && D.isLow(st, product)) D.suggest(st, product);
                    }
                  }, 'Added to your list');
                }}
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
      </div>

      <DialogModal
        modal={modal}
        state={s}
        onClose={() => setModal(null)}
        onSubmit={handleModalSubmit}
        onManageExisting={(product) =>
          setModal({ type: 'stock', revision: dataRef.current?.revision ?? data.revision, product })
        }
        onSuggestCategory={online ? suggestNewItemCategory : undefined}
      />

      <CategoryReviewDialog
        key={categoryReview?.reviewId || 'closed'}
        review={categoryReview}
        onClose={() => setCategoryReview(null)}
        onApply={applyCategoryAssignments}
      />

      <Toast message={toastMessage} onClear={() => setToastMessage(null)} />
    </>
  );
};
