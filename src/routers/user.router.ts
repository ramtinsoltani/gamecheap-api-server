import { Router, RouteMethod, OnInjection, custom, header, body, type, opt, len, and, num } from '@steroids/core';
import { Response } from 'express';
import { AuthenticatedRequest } from '@steroids/router/auth';
import { AuthService } from '@steroids/service/auth';
import { UserService } from '@steroids/service/user';

import { bearerTokenParser } from '@steroids/middleware/bearer-token-parser';
import { accessTokenAuth } from '@steroids/middleware/access-token-auth';
import { userAccessScope } from '@steroids/middleware/user-access-scope';
import { verified } from '@steroids/middleware/verified';

import { bearerTokenHeaderValidator } from '@steroids/validator/bearer-token';
import { dateValidator } from '@steroids/validator/date';
import { objectIdParamValidator } from '@steroids/validator/object-id';

@Router({
  name: 'user',
  routes: [
    // All endpoints from this point downward are protected by access tokens
    { path: '/user', handler: 'bearerTokenParser', validate: [
      custom(bearerTokenHeaderValidator)
    ]},
    { path: '/user', handler: 'accessTokenAuth' },
    { path: '/user/profile', method: RouteMethod.GET, handler: 'userProfile' },
    { path: '/user/update', method: RouteMethod.POST, handler: 'userUpdate', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        firstName: opt(and(type.string, len.range(1, 32))),
        lastName: opt(and(type.string, len.range(1, 32))),
        dob: opt(dateValidator)
      })
    ]},
    // The following endpoint requires a verified account
    { path: '/user/credits', method: RouteMethod.POST, handler: 'verified' },
    { path: '/user/credits', method: RouteMethod.POST, handler: 'userCredits', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        adjustBy: and(type.number, num.min(0))
      })
    ]},
    { path: '/user/delete', method: RouteMethod.DELETE, handler: 'userDelete' },
    // All endpoints from this point downward require user access scope
    { path: '/user', handler: 'userAccessScope' },
    // All endpoints from this point downward require a verified account
    { path: '/user', method: RouteMethod.POST, handler: 'verified' },
    { path: '/user/list', method: RouteMethod.GET, handler: 'userList' },
    { path: '/user/:id/profile', method: RouteMethod.GET, handler: 'userProfileById', validate: [
      custom(objectIdParamValidator)
    ]},
    { path: '/user/:id/update', method: RouteMethod.POST, handler: 'userUpdateById', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        firstName: opt(and(type.string, len.range(1, 32))),
        lastName: opt(and(type.string, len.range(1, 32))),
        dob: opt(dateValidator)
      }),
      custom(objectIdParamValidator)
    ]},
    { path: '/user/:id/credits', method: RouteMethod.POST, handler: 'userCreditsById', validate: [
      header({ 'content-type': 'application/json' }),
      body({
        adjustBy: type.number
      }),
      custom(objectIdParamValidator)
    ]},
    { path: '/user/:id/delete', method: RouteMethod.DELETE, handler: 'userDeleteById', validate: [
      custom(objectIdParamValidator)
    ]},
  ]
})
export class UserRouter implements OnInjection {

  private auth: AuthService;
  private user: UserService;

  onInjection(services: any) {

    this.auth = services.auth;
    this.user = services.user;

  }

  // Middleware
  public get bearerTokenParser() { return bearerTokenParser; }
  public get accessTokenAuth() { return accessTokenAuth(this.auth); }
  public get userAccessScope() { return userAccessScope; }
  public get verified() { return verified; }

  // Endpoints
  public userProfile(req: AuthenticatedRequest, res: Response) {

    // Get current user's profile
    this.user.getUserProfile(req.tokenData.uid)
    .then(profile => res.json(profile))
    .catch(error => res.status(400).json(error));

  }

  public userUpdate(req: UserUpdateRequest, res: Response) {

    // Update current user's profile
    this.user.updateUserProfile(req.tokenData.uid, req.body)
    .then(() => res.json({ message: 'User profile has been updated successfully.' }))
    .catch(error => res.status(400).json(error))

  }

  public userCredits(req: UserCreditsRequest, res: Response) {

    // Adjust current user's credits (addition only)
    this.user.adjustCredits(req.tokenData.uid, req.body.adjustBy)
    .then(() => res.json({ message: 'User credits have been successfully adjusted.' }))
    .catch(error => res.status(400).json(error));

  }

  public userDelete(req: AuthenticatedRequest, res: Response) {

    // Delete current user data
    this.user.deleteUserData(req.tokenData.uid)
    .then(() => res.json({ message: 'User data has been successfully deleted.' }))
    .catch(error => res.status(400).json(error));

  }

  public userList(req: AuthenticatedRequest, res: Response) {

    this.user.getUsersList()
    .then(list => res.json(list))
    .catch(error => res.status(500).json(error));

  }

  public userProfileById(req: AuthenticatedRequest, res: Response) {

    // Get specific user profile
    this.user.getUserProfile(req.params.id)
    .then(profile => res.json(profile))
    .catch(error => res.status(400).json(error));

  }

  public userUpdateById(req: UserUpdateRequest, res: Response) {

    // Update the specified user's profile
    this.user.updateUserProfile(req.params.id, req.body)
    .then(() => res.json({ message: 'User profile has been updated successfully.' }))
    .catch(error => res.status(400).json(error))

  }

  public userCreditsById(req: UserCreditsRequest, res: Response) {

    // Adjust the specified user's credits
    this.user.adjustCredits(req.params.id, req.body.adjustBy)
    .then(() => res.json({ message: 'User credits have been successfully adjusted.' }))
    .catch(error => res.status(400).json(error));

  }

  public userDeleteById(req: AuthenticatedRequest, res: Response) {

    // Delete the specified user data
    this.user.deleteUserData(req.params.id)
    .then(() => res.json({ message: 'User data has been successfully deleted.' }))
    .catch(error => res.status(400).json(error));

  }

}

export interface UserUpdateRequest extends AuthenticatedRequest {

  body: {
    firstName?: string;
    lastName?: string;
    dob?: string;
  };

}

export interface UserCreditsRequest extends AuthenticatedRequest {

  body: {
    adjustBy: number;
  };

}
