import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'

import { getFileKey, getFilePrefix } from '@payloadcms/plugin-cloud-storage/utilities'
import { BlobNotFoundError, del, get, put } from '@vercel/blob'

import type { PayloadRequest } from 'payload'

type IncomingFile = { buffer: Buffer; filename: string; mimeType: string }

/** The subset of the upload payload this adapter reads. */
type UploadData = {
  filename?: string
  mimeType?: string
  prefix?: string
  sizes?: Record<string, { filename?: string; mimeType?: string }>
}

/** The plugin's own stash, used when `req.file` has already been cleared. */
type CloudStorageContext = {
  _payloadCloudStorage?: {
    file?: { data: Buffer }
    uploadSizes?: Record<string, Buffer>
  }
}

/**
 * Mirrors the plugin's own `getIncomingFiles`, which is internal and not part of
 * its `/utilities` export. Kept faithful to that implementation — including the
 * `req.context._payloadCloudStorage` fallback for when `req.file` has been
 * cleared — so resized variants upload alongside the original if `media` ever
 * gains `imageSizes`. It defines none today, so this returns a single file.
 */
function incomingFiles({ data, req }: { data: UploadData; req: PayloadRequest }): IncomingFile[] {
  const ctx = (req.context as CloudStorageContext)?._payloadCloudStorage
  const file = req.file ?? ctx?.file
  const uploadSizes = req.payloadUploadSizes ?? ctx?.uploadSizes

  if (!file || !data?.filename || !data?.mimeType) return []

  const files: IncomingFile[] = [
    { buffer: file.data, filename: data.filename, mimeType: data.mimeType },
  ]

  for (const [key, resized] of Object.entries(data.sizes ?? {})) {
    const buffer = uploadSizes?.[key]
    if (buffer && resized?.mimeType && resized?.filename) {
      files.push({ buffer, filename: resized.filename, mimeType: resized.mimeType })
    }
  }

  return files
}

/**
 * Vercel Blob against a PRIVATE store.
 *
 * Payload's own `@payloadcms/storage-vercel-blob` cannot do this. Its `access`
 * option is typed `'public'` and nothing else (3.87.1 and the latest stable
 * 3.88.0), so a private store rejects its uploads outright; and its read path
 * calls `head(url, { token })` for metadata but then fetches the bytes with a
 * plain unauthenticated `fetch` of `<store>.public.blob.vercel-storage.com`,
 * which a private store answers with 403 — surfacing as an empty 204, not an
 * error. Both limits are in the adapter, not in the token's authority.
 *
 * The SDK itself supports private blobs fully: `get()` takes a token and streams
 * the bytes. This adapter is that one call, plus the upload and delete around it.
 *
 * Why bother: an archived invoice is a legal record carrying a client's name,
 * ABN and bank details. On a public store the only thing standing between that
 * PDF and the internet is an unguessable URL. Here the store refuses anonymous
 * reads outright, and Payload's access control is the sole way in.
 *
 * Everything addresses blobs by PATHNAME rather than URL, so no public base URL
 * is ever constructed. `generateURL` is deliberately not implemented: without it
 * `media.url` stays Payload's own access-controlled route, and a raw blob URL
 * cannot leak into an API response.
 */
export const vercelBlobPrivateAdapter = ({
  cacheControlMaxAge = 365 * 24 * 60 * 60,
  token,
}: {
  cacheControlMaxAge?: number
  token: string
}): Adapter =>
  ({ collection, prefix }) => ({
    name: 'vercel-blob-private',

    handleUpload: async ({ data, file, req }) => {
      // Sizes as well as the original, so an image collection stays correct.
      const incoming = incomingFiles({ data, req })
      const files: IncomingFile[] =
        incoming.length > 0
          ? incoming
          : [{ buffer: file.buffer, filename: file.filename, mimeType: file.mimeType }]

      await Promise.all(
        files.map(async (each) => {
          const { fileKey } = getFileKey({
            collectionPrefix: prefix,
            docPrefix: data.prefix,
            filename: each.filename,
          })

          await put(fileKey, each.buffer, {
            access: 'private',
            // Deliberately off. On a public store a random suffix is the only
            // defence against guessing `invoice-6.pdf`; here the store is
            // private, so keys can stay deterministic and readable. Payload
            // already guarantees unique filenames within the collection.
            addRandomSuffix: false,
            allowOverwrite: true,
            cacheControlMaxAge,
            contentType: each.mimeType,
            token,
          })
        }),
      )
    },

    handleDelete: async ({ doc, filename }) => {
      const { fileKey } = getFileKey({
        collectionPrefix: prefix,
        docPrefix: (doc as { prefix?: string })?.prefix,
        filename,
      })
      await del(fileKey, { token })
    },

    staticHandler: async (req, { params }) => {
      try {
        const docPrefix = await getFilePrefix({
          clientUploadContext: params.clientUploadContext,
          collection,
          filename: params.filename,
          prefixQueryParam: params.prefix,
          req,
        })
        const { fileKey } = getFileKey({
          collectionPrefix: prefix,
          docPrefix,
          filename: params.filename,
        })

        // The authenticated read. This is the call the first-party adapter omits.
        const result = await get(fileKey, { access: 'private', token })
        if (!result) {
          return new Response(null, { status: 404, statusText: 'Not Found' })
        }
        if (result.statusCode === 304) {
          return new Response(null, { status: 304 })
        }

        const headers = new Headers()
        headers.set('Content-Type', result.blob.contentType)
        headers.set('Content-Length', String(result.blob.size))
        // `private`, not `public`: this response passed an access check, so it
        // must not be cached by a shared proxy and served to someone who would
        // not have passed it.
        headers.set('Cache-Control', `private, max-age=${cacheControlMaxAge}`)

        const disposition = result.headers.get('content-disposition')
        if (disposition) headers.set('Content-Disposition', disposition)
        const etag = result.headers.get('etag')
        if (etag) headers.set('ETag', etag)

        // SVGs can carry script; the upload allowlist excludes them today, but
        // this costs nothing and survives someone widening `mimeTypes`.
        if (result.blob.contentType === 'image/svg+xml') {
          headers.set('Content-Security-Policy', "script-src 'none'")
        }

        return new Response(result.stream, { headers, status: 200 })
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          return new Response(null, { status: 404, statusText: 'Not Found' })
        }
        req.payload.logger.error({ err, msg: 'vercel-blob-private staticHandler failed' })
        return new Response('Internal Server Error', { status: 500 })
      }
    },
  })
