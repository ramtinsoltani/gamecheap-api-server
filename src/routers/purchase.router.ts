import { Router, RouteMethod, OnInjection, header, body, and, type, len, opt, custom } from '@steroids/core';
import { Response } from 'express';
import { AuthenticatedRequest } from '@steroids/router/auth';

import { AuthService } from '@steroids/service/auth';
import { PurchaseService } from '@steroids/service/purchase';

import { bearerTokenParser } from '@steroids/middleware/bearer-token-parser';
import { accessTokenAuth } from '@steroids/middleware/access-token-auth';
import { userAccessScope } from '@steroids/middleware/user-access-scope';
import { verified } from '@steroids/middleware/verified';

import { objectIdParamValidator } from '@steroids/validator/object-id';

@Router({
  name: 'purchase',
  routes: [
    // All endpoints from here downward are protected by access tokens.
    { path: '/purchase', handler: 'bearerTokenParser' },
    { path: '/purchase', handler: 'accessTokenAuth' },
    { path: '/purchase/history', method: RouteMethod.GET, handler: 'purchaseHistory' },
    { path: '/purchase/:id', method: RouteMethod.GET, handler: 'purchaseInfoById', validate: [
      custom(objectIdParamValidator)
    ]},
    // All endpoints from here downward require a verified account
    { path: '/purchase', handler: 'verified' },
    { path: '/purchase/:id/refund', method: RouteMethod.POST, handler: 'purchaseRefundById', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        reason: opt(and(type.string, len.range(10, 256)))
      }),
      custom(objectIdParamValidator)
    ]},
    // All endpoints from here downward are protecrted by user management access scope
    { path: '/purchase', handler: 'userAccessScope' },
    { path: '/purchase/:id/history', method: RouteMethod.GET, handler: 'purchaseHistoryByUid', validate: [
      custom(objectIdParamValidator)
    ]}
  ]
})
export class PurchaseRouter implements OnInjection {

  private auth: AuthService;
  private purchase: PurchaseService;

  onInjection(services: any) {

    this.auth = services.auth;
    this.purchase = services.purchase;

  }

  // Middleware
  public get bearerTokenParser() { return bearerTokenParser; }
  public get accessTokenAuth() { return accessTokenAuth(this.auth); }
  public get userAccessScope() { return userAccessScope; }
  public get verified() { return verified; }

  // Endpoints
  public purchaseInfoById(req: AuthenticatedRequest, res: Response) {

    this.purchase.getById(<string>req.params.id, req.tokenData.access, req.tokenData.uid)
    .then(info => res.json(info))
    .catch(error => res.status(400).json(error));

  }

  public purchaseHistory(req: AuthenticatedRequest, res: Response) {

    this.purchase.getHistory(req.tokenData.uid)
    .then(history => res.json(history))
    .catch(error => res.status(400).json(error));

  }

  public purchaseRefundById(req: RefundRequest, res: Response) {

    this.purchase.refund(<string>req.params.id, req.tokenData.uid, req.body.reason)
    .then(() => res.json({ message: 'Credits were refunded successfully.' }))
    .catch(error => res.status(400).json(error));

  }

  public purchaseHistoryByUid(req: AuthenticatedRequest, res: Response) {

    this.purchase.getHistory(<string>req.params.id)
    .then(history => res.json(history))
    .catch(error => res.status(400).json(error));

  }

}

export interface RefundRequest extends AuthenticatedRequest {

  body: {
    reason?: string;
  };

}
