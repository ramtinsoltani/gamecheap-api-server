import { Router, RouteMethod, OnInjection, query, custom, header, body, type, and, len, num, opt } from '@steroids/core';
import { Request, Response } from 'express';

import { AuthenticatedRequest } from '@steroids/router/auth';
import { GameClient } from '@steroids/model/game';

import { AuthService } from '@steroids/service/auth';
import { GamesService } from '@steroids/service/games';

import { bearerTokenParser } from '@steroids/middleware/bearer-token-parser';
import { accessTokenAuth } from '@steroids/middleware/access-token-auth';
import { inventoryAccessScope } from '@steroids/middleware/inventory-access-scope';
import { verified } from '@steroids/middleware/verified';

import { gameSalePriceValidator } from '@steroids/validator/game-sale-price';
import { objectIdParamValidator } from '@steroids/validator/object-id';

@Router({
  name: 'games',
  routes: [
    { path: '/games/query', method: RouteMethod.GET, handler: 'gamesQuery', validate: [
      query(['q'])
    ]},
    { path: '/games/list/new', method: RouteMethod.GET, handler: 'gamesListNew', validate: [
      query(['count'])
    ]},
    { path: '/games/list/best', method: RouteMethod.GET, handler: 'gamesListBest', validate: [
      query(['count'])
    ]},
    { path: '/games/list/popular', method: RouteMethod.GET, handler: 'gamesListPopular', validate: [
      query(['count'])
    ]},
    { path: '/games/list/random', method: RouteMethod.GET, handler: 'gamesListRandom', validate: [
      query(['count'])
    ]},
    { path: '/games/:id', method: RouteMethod.GET, handler: 'gamesById', validate: [
      custom(objectIdParamValidator)
    ]},
    { path: '/games/short/:id', method: RouteMethod.GET, handler: 'gamesShortById', validate: [
      custom(objectIdParamValidator)
    ]},
    // All endpoints from here downward are protected by access tokens.
    { path: '/games', handler: 'bearerTokenParser' },
    { path: '/games', handler: 'accessTokenAuth' },
    // All endpoints from here downward require a verified account
    { path: '/games', handler: 'verified' },
    { path: '/games/:id/purchase', method: RouteMethod.GET, handler: 'gamesPurchaseById', validate: [
      custom(objectIdParamValidator)
    ]},
    // All endpoints from here downward are protected by inventory access scope.
    { path: '/games', handler: 'inventoryAccessScope' },
    { path: '/games/igdb/query', method: RouteMethod.GET, handler: 'gamesIgdbQuery', validate: [
      query(['q'])
    ]},
    { path: '/games/new', method: RouteMethod.POST, handler: 'gamesNew', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        igdbId: and(type.number, num.min(1)),
        price: and(type.number, num.min(1)),
        salePrice: opt(and(type.number, num.min(1))),
        client: type.ofenum(GameClient)
      }),
      custom(gameSalePriceValidator)
    ]},
    { path: '/games/:id/code', method: RouteMethod.POST, handler: 'gamesCodeAddById', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        codes: type.array(and(type.string, len.min(1)), len.min(1))
      }),
      custom(objectIdParamValidator)
    ]},
    { path: '/games/:id/code', method: RouteMethod.DELETE, handler: 'gamesCodeDeleteById', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        code: and(type.string, len.min(1))
      }),
      custom(objectIdParamValidator)
    ]},
    { path: '/games/:id/delete', method: RouteMethod.DELETE, handler: 'gamesDeleteById', validate: [
      custom(objectIdParamValidator)
    ]},
    { path: '/games/:id/update', method: RouteMethod.POST, handler: 'gamesUpdateById', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        price: and(type.number, num.min(1)),
        salePrice: opt(and(type.number, num.min(1)))
      }),
      custom(gameSalePriceValidator),
      custom(objectIdParamValidator)
    ]}
  ]
})
export class GamesRouter implements OnInjection {

  private auth: AuthService;
  private games: GamesService;

  onInjection(services: any) {

    this.auth = services.auth;
    this.games = services.games;

  }

  // Middleware
  public get bearerTokenParser() { return bearerTokenParser; }
  public get accessTokenAuth() { return accessTokenAuth(this.auth); }
  public get inventoryAccessScope() { return inventoryAccessScope; }
  public get verified() { return verified; }

  // Endpoints
  public gamesQuery(req: Request, res: Response) {

    this.games.queryGames(<string>req.query.q)
    .then(results => res.json(results))
    .catch(error => res.status(500).json(error));

  }

  public gamesListNew(req: Request, res: Response) {

    this.games.queryGamesCondition({}, +req.query.count || 10, 'updatedAt', false)
    .then(result => res.json(result))
    .catch(error => res.status(500).json(error));

  }

  public gamesListBest(req: Request, res: Response) {

    this.games.queryGamesCondition({}, +req.query.count || 10, 'saleRatio', false)
    .then(result => res.json(result))
    .catch(error => res.status(500).json(error));

  }

  public gamesListPopular(req: Request, res: Response) {

    this.games.queryGamesCondition({}, +req.query.count || 10, 'popularity', false)
    .then(result => res.json(result))
    .catch(error => res.status(500).json(error));

  }

  public gamesListRandom(req: Request, res: Response) {

    this.games.getRandomGames(+req.query.count || 10)
    .then(result => res.json(result))
    .catch(error => res.status(500).json(error));

  }

  public gamesById(req: Request, res: Response) {

    this.games.getGameInfo(<string>req.params.id)
    .then(info => res.json(info))
    .catch(error => res.status(400).json(error));

  }

  public gamesShortById(req: Request, res: Response) {

    this.games.getGameShortInfo(<string>req.params.id)
    .then(info => res.json(info))
    .catch(error => res.status(400).json(error));

  }

  public gamesPurchaseById(req: AuthenticatedRequest, res: Response) {

    this.games.purchaseGame(<string>req.params.id, req.tokenData.uid)
    .then(id => res.json({ message: 'Game was successfully purchased.', id }))
    .catch(error => res.status(400).json(error));

  }

  public gamesIgdbQuery(req: AuthenticatedRequest, res: Response) {

    this.games.queryIGDB(<string>req.query.q)
    .then(results => res.json(results))
    .catch(error => res.status(500).json(error));

  }

  public gamesNew(req: AuthenticatedRequest, res: Response) {

    this.games.addGame(req.body)
    .then(id => res.json({ id, message: 'Game was successfully added.' }))
    .catch(error => res.status(400).json(error));

  }

  public gamesCodeAddById(req: AddCodeRequest, res: Response) {

    this.games.addGameCode(<string>req.params.id, req.body.codes)
    .then(() => res.json({ message: 'Codes were successfully added.' }))
    .catch(error => res.status(400).json(error));

  }

  public gamesCodeDeleteById(req: DeleteCodeRequest, res: Response) {

    this.games.deleteGameCode(<string>req.params.id, req.body.code)
    .then(() => res.json({ message: 'Code was successfully deleted.' }))
    .catch(error => res.status(400).json(error));

  }

  public gamesDeleteById(req: AuthenticatedRequest, res: Response) {

    this.games.deleteGame(<string>req.params.id)
    .then(() => res.json({ message: 'Game was successfully deleted.' }))
    .catch(error => res.status(400).json(error));

  }

  public gamesUpdateById(req: UpdateGameRequest, res: Response) {

    this.games.updateGame(<string>req.params.id, req.body)
    .then(() => res.json({ message: 'Game was successfully updated.' }))
    .catch(error => res.status(400).json(error));

  }

}

export interface AddCodeRequest extends AuthenticatedRequest {

  body: {
    codes: Array<string>;
  };

}

export interface DeleteCodeRequest extends AuthenticatedRequest {

  body: {
    code: string;
  };

}

export interface UpdateGameRequest extends AuthenticatedRequest {

  body: {
    price?: number;
    salePrice?: number;
  };

}

export interface NewGameRequest extends AuthenticatedRequest {

  body: UpdateGameRequest['body'] & {
    igdbId: number;
    client: GameClient;
  };

}
