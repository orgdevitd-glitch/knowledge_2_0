import "server-only";

import type { MediaAsset } from "@/domain/content/media";
import {
  ConflictError,
  RepositoryError,
  ValidationError,
} from "@/domain/shared/errors";
import { MEDIA_LIMIT_DEFAULTS } from "@/domain/shared/media-limits";
import type {
  MediaAdminListFilter,
  MediaAdminPage,
  MediaAdminSort,
  MediaRepository,
} from "@/server/repositories/interfaces/media-repository";
import type { PaginationInput, SaveOptions } from "@/server/repositories/interfaces/types";
import { normalizePagination } from "@/server/repositories/interfaces/types";
import {
  compareMediaAdmin,
  decodeMediaAdminCursor,
  encodeMediaAdminCursor,
  sortValueForMedia,
} from "@/server/repositories/media-admin-cursor";
import type { Query as FirestoreQuery } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/server/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "./collections";
import { fromMediaDoc, toMediaDoc } from "./mappers";

export class FirestoreMediaRepository implements MediaRepository {
  private col() {
    return getFirebaseAdminFirestore().collection(
      FIRESTORE_COLLECTIONS.mediaAssets,
    );
  }

  async getById(id: string): Promise<MediaAsset | null> {
    try {
      const snap = await this.col().doc(id).get();
      if (!snap.exists) return null;
      return fromMediaDoc(snap.id, snap.data());
    } catch (error) {
      throw new RepositoryError("Failed to read media asset", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async save(media: MediaAsset, options: SaveOptions): Promise<MediaAsset> {
    const db = getFirebaseAdminFirestore();
    const ref = this.col().doc(media.id);
    try {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (!current.exists) {
          if (options.expectedRevision !== 0) {
            throw new ConflictError(
              "Cannot create entity with non-zero expected revision",
            );
          }
        } else {
          const existing = fromMediaDoc(current.id, current.data());
          if (existing.revision !== options.expectedRevision) {
            throw new ConflictError("Optimistic concurrency conflict", {
              expectedRevision: options.expectedRevision,
              actualRevision: existing.revision,
            });
          }
        }
        tx.set(ref, toMediaDoc(media));
      });
      return structuredClone(media);
    } catch (error) {
      if (error instanceof ConflictError) {
        throw error;
      }
      throw new RepositoryError("Failed to save media asset", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  async listAdmin(
    filter?: MediaAdminListFilter,
    pagination?: PaginationInput,
  ): Promise<MediaAdminPage> {
    const sort: MediaAdminSort = filter?.sort ?? "updatedAt_desc";
    const { limit, cursor } = normalizePagination({
      limit: pagination?.limit ?? MEDIA_LIMIT_DEFAULTS.adminPageDefault,
      cursor: pagination?.cursor,
    });
    if (limit > MEDIA_LIMIT_DEFAULTS.adminPageMax) {
      throw new ValidationError("Invalid admin page limit", {
        adminCode: "VALIDATION_ERROR",
        limit,
      });
    }

    try {
      if (filter?.q?.trim()) {
        return this.listAdminBoundedScan(filter, limit, cursor, sort);
      }

      let query: FirestoreQuery = this.col();
      if (filter?.status) {
        query = query.where("status", "==", filter.status);
      }
      if (filter?.kind) {
        query = query.where("kind", "==", filter.kind);
      }

      query = query.orderBy("updatedAt", "desc").orderBy("__name__", "desc");

      if (cursor) {
        const decoded = decodeMediaAdminCursor(cursor, sort);
        query = query.startAfter(decoded.v, decoded.id);
      }

      const snap = await query.limit(limit).get();
      const items = snap.docs.map((d) => fromMediaDoc(d.id, d.data()));
      const last = items[items.length - 1];
      const nextCursor =
        items.length === limit && last
          ? encodeMediaAdminCursor({
              sort,
              v: sortValueForMedia(last, sort),
              id: last.id,
            })
          : null;

      return { items, nextCursor, limit, scanLimitExceeded: false };
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new RepositoryError("Failed to list media for admin", {
        cause: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  private async listAdminBoundedScan(
    filter: MediaAdminListFilter,
    limit: number,
    cursor: string | null,
    sort: MediaAdminSort,
  ): Promise<MediaAdminPage> {
    const q = filter.q!.trim().toLowerCase();
    let query: FirestoreQuery = this.col();
    if (filter.status) {
      query = query.where("status", "==", filter.status);
    }
    if (filter.kind) {
      query = query.where("kind", "==", filter.kind);
    }
    query = query.orderBy("updatedAt", "desc").orderBy("__name__", "desc");

    const snap = await query.limit(MEDIA_LIMIT_DEFAULTS.maxAdminScan + 1).get();
    const scanLimitExceeded =
      snap.docs.length > MEDIA_LIMIT_DEFAULTS.maxAdminScan;
    const items = snap.docs
      .slice(0, MEDIA_LIMIT_DEFAULTS.maxAdminScan)
      .map((d) => fromMediaDoc(d.id, d.data()))
      .filter(
        (m) =>
          String(m.title).toLowerCase().includes(q) ||
          m.originalFileName.toLowerCase().includes(q),
      )
      .sort((a, b) => compareMediaAdmin(a, b, sort));

    let start = 0;
    if (cursor) {
      const decoded = decodeMediaAdminCursor(cursor, sort);
      const idx = items.findIndex((i) => i.id === decoded.id);
      if (idx < 0) {
        throw new ValidationError("Malformed admin list cursor", {
          adminCode: "VALIDATION_ERROR",
        });
      }
      start = idx + 1;
    }
    const pageItems = items.slice(start, start + limit);
    const nextCursor =
      start + limit < items.length && pageItems.length > 0
        ? encodeMediaAdminCursor({
            sort,
            v: sortValueForMedia(pageItems[pageItems.length - 1]!, sort),
            id: pageItems[pageItems.length - 1]!.id,
          })
        : null;

    return {
      items: pageItems,
      nextCursor,
      limit,
      scanLimitExceeded,
    };
  }

  /** TEST_ONLY rollback helper — not used in Firestore production adapter */
  replaceUnchecked(_media: MediaAsset | null, _id: string): void {
    void _media;
    void _id;
    throw new RepositoryError(
      "replaceUnchecked is not supported on FirestoreMediaRepository",
    );
  }
}
