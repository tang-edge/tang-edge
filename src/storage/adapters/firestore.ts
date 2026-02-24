import type { TangStorage, TangStorageListResult } from "../interface";
import { Firestore } from "@google-cloud/firestore";

const COLLECTION = "tang-keys";

export class FirestoreStorage implements TangStorage {
  private readonly db: Firestore;

  constructor(projectId?: string) {
    this.db = new Firestore({ projectId });
  }

  async get(key: string): Promise<string | null> {
    const doc = await this.db.collection(COLLECTION).doc(key).get();
    if (!doc.exists) return null;
    return doc.data()?.value ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(key).set({ value });
  }

  async delete(key: string): Promise<void> {
    await this.db.collection(COLLECTION).doc(key).delete();
  }

  async list(): Promise<TangStorageListResult> {
    const snapshot = await this.db.collection(COLLECTION).listDocuments();
    return {
      keys: snapshot.map((doc) => ({ name: doc.id })),
    };
  }
}
