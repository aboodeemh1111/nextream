const storage = require("./index");
const { isStorageKey, isLegacyFirebaseUrl } = require("./keys");
const { fieldsFor, resolveMediaValues } = require("./mediaFields");

// Blob cleanup for deleted documents.
//
// Always call this *after* the Mongo delete has succeeded. Reversed, a failed
// database delete leaves a live document pointing at a destroyed object.
//
// Failures here never propagate: the document is already gone, so throwing
// would turn a successful delete into a 500. Anything missed is picked up by
// scripts/reapOrphans.js.

async function reapDocumentMedia(doc, model) {
  if (!doc) return { deleted: 0, legacy: 0 };

  const entries = resolveMediaValues(doc, fieldsFor(model));
  const keys = entries.map((e) => e.value).filter(isStorageKey);
  const legacy = entries.filter((e) => isLegacyFirebaseUrl(e.value));

  let deleted = 0;
  for (const key of keys) {
    try {
      await storage.deleteObject(key);
      deleted++;
    } catch (err) {
      console.error(`Failed to delete blob ${key}:`, err.message);
    }
  }

  if (legacy.length) {
    try {
      const OrphanedMedia = require("../models/OrphanedMedia");
      await OrphanedMedia.insertMany(
        legacy.map((e) => ({
          url: e.value,
          model,
          docId: doc._id ? String(doc._id) : undefined,
          field: e.spec,
        })),
        { ordered: false }
      );
    } catch (err) {
      console.error("Failed to record orphaned Firebase media:", err.message);
    }
  }

  return { deleted, legacy: legacy.length };
}

// Convenience for cascades (a season taking its episodes with it).
async function reapManyDocumentMedia(docs, model) {
  const totals = { deleted: 0, legacy: 0 };
  for (const doc of docs || []) {
    const result = await reapDocumentMedia(doc, model);
    totals.deleted += result.deleted;
    totals.legacy += result.legacy;
  }
  return totals;
}

module.exports = { reapDocumentMedia, reapManyDocumentMedia };
