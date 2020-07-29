import { Router, RouteMethod, OnInjection, custom } from '@steroids/core';
import { Response } from 'express';

import { AuthenticatedRequest } from '@steroids/router/auth';

import { AuthService } from '@steroids/service/auth';
import { LibraryService } from '@steroids/service/library';

import { bearerTokenParser } from '@steroids/middleware/bearer-token-parser';
import { accessTokenAuth } from '@steroids/middleware/access-token-auth';
import { verified } from '@steroids/middleware/verified';

import { objectIdParamValidator } from '@steroids/validator/object-id';

@Router({
  name: 'library',
  routes: [
    // All endpoints from here downward are protected by access tokens.
    { path: '/library', handler: 'bearerTokenParser' },
    { path: '/library', handler: 'accessTokenAuth' },
    { path: '/library', method: RouteMethod.GET, handler: 'libraryInfo' },
    // All endpoints from here downward require a verified account
    { path: '/library', handler: 'verified' },
    { path: '/library/code/:id', method: RouteMethod.GET, handler: 'libraryCodeRevealById', validate: [
      custom(objectIdParamValidator)
    ]}
  ]
})
export class GamesRouter implements OnInjection {

  private auth: AuthService;
  private library: LibraryService;

  onInjection(services: any) {

    this.auth = services.auth;
    this.library = services.library;

  }

  // Middleware
  public get bearerTokenParser() { return bearerTokenParser; }
  public get accessTokenAuth() { return accessTokenAuth(this.auth); }
  public get verified() { return verified; }

  // Endpoints
  public libraryInfo(req: AuthenticatedRequest, res: Response) {

    this.library.getInfo(req.tokenData.uid)
    .then(info => res.json(info))
    .catch(error => res.status(400).json(error));

  }

  public libraryCodeRevealById(req: AuthenticatedRequest, res: Response) {

    this.library.revealCode(<string>req.params.id, req.tokenData.uid)
    .then(game => res.json(game))
    .catch(error => res.status(400).json(error));

  }

}
