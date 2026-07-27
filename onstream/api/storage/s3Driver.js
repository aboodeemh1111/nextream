const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const { config, assertCredentials } = require("./config");
const sign = require("./sign");

let _client = null;
let _signingClient = null;

function client() {
  if (_client) return _client;
  const cfg = config();
  assertCredentials(cfg);
  _client = new S3Client({
    endpoint: cfg.endpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle, // required for MinIO
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return _client;
}

// Presigned URLs are consumed by the browser, so they must carry the public
// host. Only build a second client when it actually differs from the internal
// endpoint the API itself talks to.
function signingClient() {
  const cfg = config();
  if (cfg.publicEndpoint === cfg.endpoint) return client();
  if (_signingClient) return _signingClient;
  assertCredentials(cfg);
  _signingClient = new S3Client({
    endpoint: cfg.publicEndpoint,
    region: cfg.region,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return _signingClient;
}

function bucket() {
  return config().bucket;
}

// --- Uploads ----------------------------------------------------------------

// Pins Content-Type into the signature so the client must send exactly the type
// the server approved.
//
// STORAGE_MIGRATION.md §4.1 assumes this happens automatically. It does not:
// by default getSignedUrl emits X-Amz-SignedHeaders=host only, leaving
// Content-Type unsigned and the per-prefix type allowlist advisory — an
// approved image/jpeg presign would happily accept text/html bytes. Naming it
// in signableHeaders is what makes the allowlist real.
//
// Cache-Control is deliberately left unsigned: S3 and MinIO still store it when
// sent, and signing it would break the upload over a cosmetic header.
async function presignPut(key, contentType, ttl, options) {
  const opts = options || {};
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
    CacheControl: opts.cacheControl,
  });
  return getSignedUrl(signingClient(), command, {
    expiresIn: ttl || 900,
    signableHeaders: new Set(["content-type"]),
  });
}

async function createMultipart(key, contentType, options) {
  const opts = options || {};
  const out = await client().send(
    new CreateMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
      CacheControl: opts.cacheControl,
    })
  );
  return { uploadId: out.UploadId };
}

async function presignPart(key, uploadId, partNumber, ttl) {
  const command = new UploadPartCommand({
    Bucket: bucket(),
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return getSignedUrl(signingClient(), command, { expiresIn: ttl || 3600 });
}

async function completeMultipart(key, uploadId, parts) {
  const ordered = parts
    .map((p) => ({ PartNumber: Number(p.PartNumber), ETag: p.ETag }))
    .sort((a, b) => a.PartNumber - b.PartNumber);
  await client().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: ordered },
    })
  );
}

async function abortMultipart(key, uploadId) {
  await client().send(
    new AbortMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
    })
  );
}

// Streaming upload of unknown or very large size, used by the backfill.
// lib-storage splits into multipart parts as bytes arrive, so a 2 GB movie is
// never held in memory.
async function uploadStream(key, body, options) {
  const opts = options || {};
  const { Upload } = require("@aws-sdk/lib-storage");
  const upload = new Upload({
    client: client(),
    params: {
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl,
    },
    partSize: 16 * 1024 * 1024,
    queueSize: 2,
  });
  if (opts.onProgress) upload.on("httpUploadProgress", opts.onProgress);
  await upload.done();
}

// Server-side put, used by the backfill script. Body may be a stream.
async function putObject(key, body, options) {
  const opts = options || {};
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: opts.contentType,
      ContentLength: opts.contentLength,
      CacheControl: opts.cacheControl,
    })
  );
}

// --- Reads ------------------------------------------------------------------

// Synchronous under the hood (see sign.js) but kept Promise-returning so every
// driver honours the same contract. The read middleware calls sign.presignGet
// directly because res.json cannot await.
async function presignGet(key, ttl, options) {
  return sign.presignGet(key, ttl, options);
}

async function getObjectStream(key) {
  const out = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key })
  );
  return out.Body;
}

async function headObject(key) {
  try {
    const out = await client().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key })
    );
    return {
      size: out.ContentLength,
      contentType: out.ContentType,
      etag: out.ETag,
    };
  } catch (err) {
    const status = err && err.$metadata && err.$metadata.httpStatusCode;
    if (status === 404 || err.name === "NotFound" || err.name === "NoSuchKey") {
      return null;
    }
    throw err;
  }
}

// --- Deletes / listing ------------------------------------------------------

async function deleteObject(key) {
  await client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key })
  );
}

async function deleteObjects(keys) {
  if (!keys.length) return;
  for (let i = 0; i < keys.length; i += 1000) {
    const slice = keys.slice(i, i + 1000);
    await client().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: slice.map((Key) => ({ Key })), Quiet: true },
      })
    );
  }
}

// Async generator so the reaper never holds the whole bucket in memory.
async function* listObjects(prefix) {
  let token;
  do {
    const out = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    for (const obj of out.Contents || []) {
      yield { key: obj.Key, size: obj.Size, lastModified: obj.LastModified };
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (token);
}

// --- Provisioning helper ----------------------------------------------------

async function putBucketCors(rules) {
  await client().send(
    new PutBucketCorsCommand({
      Bucket: bucket(),
      CORSConfiguration: { CORSRules: rules },
    })
  );
}

module.exports = {
  presignPut,
  presignGet,
  createMultipart,
  presignPart,
  completeMultipart,
  abortMultipart,
  putObject,
  uploadStream,
  getObjectStream,
  headObject,
  deleteObject,
  deleteObjects,
  listObjects,
  putBucketCors,
};
