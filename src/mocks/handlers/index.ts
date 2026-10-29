import type { RequestHandler } from 'msw'
import { adminHandlers } from './admin'
import { adminBlockHandlers } from './adminBlocks'
import { adminCatalogHandlers } from './adminCatalog'
import { authHandlers } from './auth'
import { publicHandlers } from './public'

export const handlers: RequestHandler[] = [
  ...publicHandlers,
  ...authHandlers,
  ...adminHandlers,
  ...adminCatalogHandlers,
  ...adminBlockHandlers,
]
