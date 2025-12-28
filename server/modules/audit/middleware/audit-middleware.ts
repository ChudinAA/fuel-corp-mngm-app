
import { Request, Response, NextFunction } from "express";
import { AuditService, AuditContext } from "../services/audit-service";
import { EntityType, AuditOperation, AUDIT_OPERATIONS } from "../entities/audit";
import { storage } from "../../../storage/index";
import { normalizeAuditData } from "../utils/audit-utils";

/**
 * Extract audit context from request
 */
export function getAuditContext(req: Request): AuditContext {
  return {
    userId: req.session.userId ? String(req.session.userId) : undefined,
    ipAddress: req.ip || req.headers['x-forwarded-for'] as string || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
  };
}

/**
 * Middleware to add audit context to request
 */
export async function enrichAuditContext(req: Request, res: Response, next: NextFunction) {
  const context = getAuditContext(req);
  
  // Enrich with user data if userId is available
  if (context.userId) {
    try {
      const user = await storage.users.getUser(context.userId);
      if (user) {
        context.userName = `${user.firstName} ${user.lastName}`;
        context.userEmail = user.email;
      }
    } catch (error) {
      console.error("Error enriching audit context:", error);
    }
  }
  
  // Attach context to request for use in route handlers
  (req as any).auditContext = context;
  next();
}

/**
 * Create audit logging decorator for route handlers
 */
export interface AuditOptions {
  entityType: EntityType;
  operation: AuditOperation;
  getEntityId?: (req: Request) => string;
  getOldData?: (req: Request, res: Response) => Promise<any>;
  getNewData?: (req: Request, res: Response) => any;
}

/**
 * Middleware factory for audit logging
 * Usage: router.post('/entity', auditLog({ entityType: 'opt', operation: 'CREATE' }), handler)
 */
export function auditLog(options: AuditOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { entityType, operation, getEntityId, getOldData, getNewData } = options;
    const context = (req as any).auditContext as AuditContext;

    // Capture old data BEFORE the operation
    let capturedOldData: any = undefined;
    if (getOldData) {
      try {
        capturedOldData = await getOldData(req, res);
      } catch (error) {
        console.error("Error capturing old data:", error);
      }
    }

    // Store original send function
    const originalSend = res.send.bind(res);
    
    // Override send to capture response
    res.send = function(body: any) {
      // Only log on successful responses (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Run audit logging asynchronously (don't block response)
        (async () => {
          try {
            let entityId = getEntityId ? getEntityId(req) : req.params.id;
            
            // For CREATE operations, try to get ID from response body
            if (operation === AUDIT_OPERATIONS.CREATE && !entityId && body) {
              const parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
              entityId = parsedBody?.id || parsedBody?.data?.id;
            }

            if (!entityId) {
              console.warn(`Audit log: Could not determine entity ID for ${entityType} ${operation}`);
              return;
            }

            const rawNewData = getNewData ? getNewData(req, res) : req.body;
            
            // Normalize data before saving
            const oldData = normalizeAuditData(capturedOldData);
            const newData = normalizeAuditData(rawNewData);

            await AuditService.log({
              entityType,
              entityId,
              operation,
              oldData,
              newData,
              context,
            });
          } catch (error) {
            console.error("Error logging audit entry:", error);
          }
        })();
      }

      return originalSend(body);
    };

    next();
  };
}

/**
 * Helper function to create audit log manually in route handlers
 */
export async function logAudit(
  req: Request,
  entityType: EntityType,
  entityId: string,
  operation: AuditOperation,
  oldData?: any,
  newData?: any
) {
  const context = (req as any).auditContext as AuditContext;
  
  await AuditService.log({
    entityType,
    entityId,
    operation,
    oldData,
    newData,
    context,
  });
}

/**
 * Middleware to log VIEW operations
 */
export function auditView(entityType: EntityType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const entityId = req.params.id;
    
    // Only log if there's a valid UUID entityId (not for list endpoints)
    if (entityId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
      const context = (req as any).auditContext as AuditContext;
      
      // Log view asynchronously (don't block request)
      AuditService.log({
        entityType,
        entityId,
        operation: AUDIT_OPERATIONS.VIEW,
        context,
      }).catch(error => {
        console.error("Error logging view audit:", error);
      });
    }
    
    next();
  };
}
