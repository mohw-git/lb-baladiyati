import type { Request, Response, NextFunction } from 'express';
import * as express from 'express';

/** Max JSON body for a single Admin3 feature chunk (well under typical proxy limits). */
export const BOUNDARY_SOURCE_IMPORT_CHUNK_JSON_LIMIT = '512kb';

const chunkJsonParser = express.json({
  limit: BOUNDARY_SOURCE_IMPORT_CHUNK_JSON_LIMIT,
});

const defaultJsonParser = express.json({
  limit: process.env.JSON_BODY_LIMIT ?? '100kb',
});

function isBoundarySourceFeatureChunkRequest(req: Request): boolean {
  const path = req.path ?? req.url?.split('?')[0] ?? '';
  return (
    req.method === 'POST' &&
    /^\/platform\/boundary-source-imports\/[^/]+\/features\/?$/.test(path)
  );
}

/**
 * Express default JSON limit is 100kb. Admin3 chunk uploads need a higher cap
 * only on POST /platform/boundary-source-imports/:id/features.
 */
export function configureJsonBodyParsers(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isBoundarySourceFeatureChunkRequest(req)) {
    chunkJsonParser(req, res, next);
    return;
  }
  defaultJsonParser(req, res, next);
}
