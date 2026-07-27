// Returns the active driver. One switch, so a hand-rolled backend can slot in
// later without touching any call site.
//
// Contract every driver implements:
//   presignPut(key, contentType, ttl, { cacheControl })  -> Promise<string>
//   presignGet(key, ttl, { download })                   -> Promise<string>
//   createMultipart(key, contentType, { cacheControl })   -> Promise<{ uploadId }>
//   presignPart(key, uploadId, partNumber, ttl)          -> Promise<string>
//   completeMultipart(key, uploadId, parts)              -> Promise<void>
//   abortMultipart(key, uploadId)                        -> Promise<void>
//   putObject(key, body, { contentType, contentLength })  -> Promise<void>
//   getObjectStream(key)                                 -> Promise<Readable>
//   headObject(key)                    -> Promise<{ size, contentType } | null>
//   deleteObject(key)                                    -> Promise<void>
//   deleteObjects(keys)                                  -> Promise<void>
//   listObjects(prefix)                -> AsyncIterable<{ key, size }>

const DRIVERS = ["s3"];

const name = (process.env.STORAGE_DRIVER || "s3").trim();
if (DRIVERS.indexOf(name) === -1) {
  throw new Error(
    `Unknown STORAGE_DRIVER "${name}". Available: ${DRIVERS.join(", ")}`
  );
}

module.exports = require(`./${name}Driver`);
