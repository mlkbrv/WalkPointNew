/**
 * Everything the app reads from the server.
 *
 * This is the migration seam. `StrideContext` keeps the local UI concerns it was
 * always about — the active workout, toasts, the selected brand — while anything
 * the server owns (balance, catalogue, vouchers, stories, inbox) is read here.
 * Screens move across one at a time; nothing has to be converted in one go.
 *
 * Two rules this context enforces:
 *
 * * **The server's number wins.** A balance is `SUM(ledger)` on the server, so
 *   after any mutation the response replaces what we were showing rather than the
 *   client recomputing it.
 * * **The cache is a cache.** Sections render from the last good response while
 *   revalidating, so a slow network shows stale data rather than a spinner over
 *   content the user already saw.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ApiError, describeError } from "../api/client";
import {
  catalogueApi,
  inboxApi,
  storiesApi,
  walletApi,
  type ApiCoupon,
  type ApiLedgerEntry,
  type ApiNotification,
  type ApiStore,
  type ApiStory,
  type ApiVoucher,
  type ApiWallet,
} from "../api/endpoints";
import { useAuth } from "./AuthContext";

/**
 * The API models a story as one media item; the viewer shows a brand with several
 * frames. Grouping by partner is the mapping between the two, and it lives here
 * so both the rail and the full-screen viewer agree on what "a story" is.
 */
export interface StoryGroup {
  partnerId: string;
  partnerName: string;
  logo: string | null;
  frames: ApiStory[];
}

export interface Section<T> {
  data: T;
  loading: boolean;
  error: string | null;
  /** True once a first response has landed, so screens can tell empty from unloaded. */
  loaded: boolean;
}

function idle<T>(initial: T): Section<T> {
  return { data: initial, loading: false, error: null, loaded: false };
}

type ServerDataValue = {
  wallet: Section<ApiWallet>;
  ledger: Section<ApiLedgerEntry[]>;
  vouchers: Section<ApiVoucher[]>;
  stores: Section<ApiStore[]>;
  coupons: Section<ApiCoupon[]>;
  stories: Section<ApiStory[]>;
  storyGroups: StoryGroup[];
  inbox: Section<ApiNotification[]>;
  unreadCount: number;

  refreshWallet: () => Promise<void>;
  refreshCatalogue: () => Promise<void>;
  refreshStories: () => Promise<void>;
  refreshInbox: () => Promise<void>;
  refreshAll: () => Promise<void>;

  purchaseCoupon: (couponId: string) => Promise<{ ok: boolean; error?: string; code?: string }>;
  markStorySeen: (storyId: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
};

const ServerDataContext = createContext<ServerDataValue | null>(null);

const EMPTY_WALLET: ApiWallet = { balance: 0, earned_total: 0, spent_total: 0 };

export function ServerDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const signedIn = user !== null;

  const [wallet, setWallet] = useState<Section<ApiWallet>>(idle(EMPTY_WALLET));
  const [ledger, setLedger] = useState<Section<ApiLedgerEntry[]>>(idle([]));
  const [vouchers, setVouchers] = useState<Section<ApiVoucher[]>>(idle([]));
  const [stores, setStores] = useState<Section<ApiStore[]>>(idle([]));
  const [coupons, setCoupons] = useState<Section<ApiCoupon[]>>(idle([]));
  const [stories, setStories] = useState<Section<ApiStory[]>>(idle([]));
  const [inbox, setInbox] = useState<Section<ApiNotification[]>>(idle([]));
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Runs one section's load, keeping the previous data visible while it is in
   * flight and on failure. Clearing on error is what makes a screen flash empty
   * when a request times out.
   */
  const load = useCallback(
    async <T,>(
      setter: React.Dispatch<React.SetStateAction<Section<T>>>,
      loader: () => Promise<T>,
    ) => {
      setter((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await loader();
        setter({ data, loading: false, error: null, loaded: true });
      } catch (caught) {
        setter((current) => ({
          ...current,
          loading: false,
          error: describeError(caught),
        }));
      }
    },
    [],
  );

  const refreshWallet = useCallback(async () => {
    if (!signedIn) return;
    await Promise.all([
      load(setWallet, () => walletApi.summary()),
      load(setLedger, async () => (await walletApi.ledger()).items),
      load(setVouchers, () => walletApi.vouchers()),
    ]);
  }, [signedIn, load]);

  const refreshCatalogue = useCallback(async () => {
    // Public: browsable before signing in.
    await Promise.all([
      load(setStores, () => catalogueApi.stores()),
      load(setCoupons, () => catalogueApi.coupons()),
    ]);
  }, [load]);

  const refreshStories = useCallback(async () => {
    await load(setStories, () => storiesApi.feed());
  }, [load]);

  const refreshInbox = useCallback(async () => {
    if (!signedIn) return;
    setInbox((current) => ({ ...current, loading: true, error: null }));
    try {
      const page = await inboxApi.list();
      setInbox({ data: page.items, loading: false, error: null, loaded: true });
      setUnreadCount(page.unread);
    } catch (caught) {
      setInbox((current) => ({ ...current, loading: false, error: describeError(caught) }));
    }
  }, [signedIn, load]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshWallet(), refreshCatalogue(), refreshStories(), refreshInbox()]);
  }, [refreshWallet, refreshCatalogue, refreshStories, refreshInbox]);

  useEffect(() => {
    void refreshCatalogue();
    void refreshStories();
  }, [refreshCatalogue, refreshStories]);

  useEffect(() => {
    if (!signedIn) {
      // Signing out must not leave another account's wallet on screen.
      setWallet(idle(EMPTY_WALLET));
      setLedger(idle([]));
      setVouchers(idle([]));
      setInbox(idle([]));
      setUnreadCount(0);
      return;
    }
    void refreshWallet();
    void refreshInbox();
  }, [signedIn, refreshWallet, refreshInbox]);

  const purchaseCoupon = useCallback(
    async (couponId: string) => {
      try {
        const result = await catalogueApi.purchase(couponId);
        // The server's balance is the truth; take it rather than subtracting locally.
        setWallet((current) => ({
          ...current,
          data: { ...current.data, balance: result.balance },
          loaded: true,
        }));
        setVouchers((current) => ({
          ...current,
          data: [result.voucher, ...current.data],
          loaded: true,
        }));
        // Stock changed for everyone, and the ledger gained an entry.
        void refreshCatalogue();
        void load(setLedger, async () => (await walletApi.ledger()).items);
        return { ok: true };
      } catch (caught) {
        return {
          ok: false,
          error: describeError(caught),
          code: caught instanceof ApiError ? caught.code : undefined,
        };
      }
    },
    [refreshCatalogue, load],
  );

  const markStorySeen = useCallback(
    async (storyId: string) => {
      if (!signedIn) return;
      // Fire and forget: a failed "seen" is not worth interrupting the viewer.
      await storiesApi.markSeen(storyId).catch(() => undefined);
    },
    [signedIn],
  );

  const markNotificationRead = useCallback(async (id: string) => {
    setInbox((current) => ({
      ...current,
      data: current.data.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
    }));
    setUnreadCount((count) => Math.max(0, count - 1));
    await inboxApi.markRead(id).catch(() => undefined);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setInbox((current) => ({
      ...current,
      data: current.data.map((item) => ({ ...item, is_read: true })),
    }));
    setUnreadCount(0);
    await inboxApi.markAllRead().catch(() => undefined);
  }, []);

  const storyGroups = useMemo<StoryGroup[]>(() => {
    const byPartner = new Map(stores.data.map((store) => [store.id, store]));
    const grouped = new Map<string, StoryGroup>();

    for (const story of stories.data) {
      const existing = grouped.get(story.partner_id);
      if (existing) {
        existing.frames.push(story);
        continue;
      }
      const partner = byPartner.get(story.partner_id);
      grouped.set(story.partner_id, {
        partnerId: story.partner_id,
        partnerName: partner?.company_name ?? "Partner",
        logo: partner?.logo_path ?? null,
        frames: [story],
      });
    }

    return [...grouped.values()];
  }, [stories.data, stores.data]);

  const value = useMemo<ServerDataValue>(
    () => ({
      wallet,
      ledger,
      vouchers,
      stores,
      coupons,
      stories,
      storyGroups,
      inbox,
      unreadCount,
      refreshWallet,
      refreshCatalogue,
      refreshStories,
      refreshInbox,
      refreshAll,
      purchaseCoupon,
      markStorySeen,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      wallet,
      ledger,
      vouchers,
      stores,
      coupons,
      stories,
      storyGroups,
      inbox,
      unreadCount,
      refreshWallet,
      refreshCatalogue,
      refreshStories,
      refreshInbox,
      refreshAll,
      purchaseCoupon,
      markStorySeen,
      markNotificationRead,
      markAllNotificationsRead,
    ],
  );

  return <ServerDataContext.Provider value={value}>{children}</ServerDataContext.Provider>;
}

export function useServerData() {
  const ctx = useContext(ServerDataContext);
  if (!ctx) throw new Error("useServerData must be used within ServerDataProvider");
  return ctx;
}
