# Game Cheap API Server

This server sits in front of a MongoDB and exposes a RESTful API for performing various operations with the database.

## Index

  - [Installation](#installation)
    - [Prerequisites](#prerequisites)
    - [Building The Source](#building-the-source)
    - [Configuring The Server](#configuring-the-server)
    - [Running The Server](#running-the-server)
  - [Authentication](#authentication)
    - [Account Registration](#account-registration)
    - [Login](#login)
    - [Account Verification](#account-verification)
    - [Password Reset](#password-reset)
    - [Tokens](#tokens)
    - [Access Scopes](#access-scopes)
  - [User Management](#user-management)
  - [Games](#games)
  - [Inventory Management](#inventory-management)
    - [Managing Games](#managing-games)
    - [Managing Codes](#managing-codes)
  - [Purchases](#purchases)
    - [Purchase History](#purchase-history)
    - [Refunds](#refunds)
  - [User Library](#user-library)
    - [Revealing Codes](#revealing-codes)
  - [API Reference](#api-reference)
    - [Endpoints](#endpoints)
    - [Data Models](#data-models)

## Installation

This server can be installed on a production machine by following the steps below.

### Prerequisites

Make sure to have the following prerequisites installed on your machine:
  1. NodeJS 12+ and NPM
  2. [Steroids CLI](https://www.npmjs.com/package/@chisel/steroids) (`npm install @chisel/steroids -g`)
  3. A MongoDB server running
  4. Clone this repo on your machine

### Configuring The Server

The server config file is located at `/src/config.json` and accepts the following keys as an addition to [Steroids default config](https://github.com/chisel/steroids/blob/master/docs/steroids.md#server-config) keys:

| Key | Type | Description |
|:----|:----:|:------------|
| **hostUrl** | String | A full URL (including protocol and port) of this server to use for generating links. |
| **token** | Object | An object containing token configuration keys. |
| token.**accessSecret** | String | A secret key for signing access tokens. |
| token.**refreshSecret** | String | A secret key for signing refresh tokens. |
| token.**verificationSecret** | String | A secret key for signing verification tokens. |
| token.**accessLifespan** | Number | The number of seconds access tokens expire after being issued. |
| token.**refreshLifespan** | Number | The number of seconds refresh tokens expire after being issued. |
| **database** | Object | An object containing database configuration keys. |
| database.**host** | String | MongoDB host address (without the `mongodb://`). |
| database.**port** | Number | MongoDB port. |
| database.**db** | String | MongoDB database name to use. |
| **email** | Object | An object containing email configuration keys. |
| email.**smtpHost** | String | The SMTP server host address to use for sending emails. |
| email.**smtpPort** | Number | The SMTP port number. |
| email.**smtpUser** | String | The SMTP username for authentication. |
| email.**smtpPass** | String | The SMTP password for authentication. |
| email.**senderName** | String | The sender name to use when sending emails. |
| email.**senderEmail** | String | The email address to use when sending emails (must be accepted by the SMTP server). |
| **igdb** | Object | An object containing IGDB configuration keys. |
| igdb.**host** | String | The IGDB API host address. |
| igdb.**token** | String | The IGDB authentication token. |
| igdb.**endpoints** | Object | An object containing IGDB API endpoint configuration keys. |
| igdb.endpoints.**games** | String | The IGDB games endpoint address. |
| igdb.endpoints.**covers** | String | The IGDB covers endpoint address. |
| igdb.endpoints.**screenshots** | String | The IGDB screenshots endpoint address. |
| igdb.endpoints.**ageRatings** | String | The IGDB age ratings endpoint address. |
| igdb.endpoints.**genres** | String | The IGDB genres endpoint address. |
| igdb.**dataTemplates** | Object | An object containing mustache templates for constructing the body data for the IGDB API. |
| igdb.dataTemplates.**games** | String | Data template for the IGDB games endpoint. |
| igdb.dataTemplates.**gamesShort** | String | Data template for the IGDB games endpoint (limited fields). |
| igdb.dataTemplates.**gamesQuery** | String | Data template for the IGDB games endpoint (query). |
| igdb.dataTemplates.**covers** | String | Data template for the IGDB covers endpoint. |
| igdb.dataTemplates.**screenshots** | String | Data template for the IGDB screenshots endpoint. |
| igdb.dataTemplates.**ageRatings** | String | Data template for the IGDB age ratings endpoint. |
| igdb.dataTemplates.**genres** | String | Data template for the IGDB genres endpoint. |
| igdb.**urlTemplates** | Object | An object containing mustache templates for constructing IGDB URLs. |
| igdb.urlTemplates.**covers** | String | A template for constructing a cover image URL. |
| igdb.urlTemplates.**thumbnails** | String | A template for constructing a thumbnail image URL. |
| igdb.urlTemplates.**screenshotsLarge** | String | A template for constructing a large screenshot image URL. |
| igdb.urlTemplates.**screenshotsSmall** | String | A template for constructing a small screenshot image URL. |
| igdb.urlTemplates.**headers** | String | A template for constructing a header image URL. |

> **NOTE:** Most values are provided in `/src/config.sample.josn` while some sensitive information has been left out (e.g. SMTP configuration values). Make sure to copy the sample config to `/src/config.json` and provide all the left out information (where it says `NOT_PROVIDED`) before running the server.

### Building The Source

Run the following command in the project root directory to build the source code into `/dist`:

```bash
sd build
```

### Running The Server

If the whole project directory is kept on the machine, then the following command will rebuild and run the server:

```bash
sd run
```

Otherwise, when inside `/dist` directory, use the following command to start the server:

```bash
node @steroids/main
```

## Authentication

The majority of the endpoints provided by this server is protected and require authentication. Users need to provide their acquired access [tokens](#tokens) in order to use the endpoints.

Some endpoints that perform administrative operations need the user to possess the [appropriate access](#access-scopes) scope in order to grant access.

### Account Registration

Account registration is done using the [Signup Endpoint](#post-authsignup). Once a user has registered a new account, two [tokens](#tokens) are returned.

### Login

Existing users can login using the [Login Endpoint](#get-authlogin) and get their [tokens](#tokens).

### Account Verification

Upon account registration, a verification email is sent to the users. The email contains a link to complete the verification.

If a new email is needed, it can be requested through the [Resend Verification Email Endpoint](#get-authverifysend).

> **NOTE:** Most endpoints require the user to be verified in order to grant access.

### Password Reset

A password reset can be requested through the [Password Reset Endpoint](#auth-resetsend). This endpoint send a short-living code to the user's email which must be provided in the [Complete Password Reset Endpoint](#auth-resetcomplete) with the new password.

### Tokens

The server issues two types of token upon authentication:
  - Access tokens: Short-lived tokens that are used for accessing all protected endpoints.
  - Refresh tokens: Long-lived tokens that are used for requesting new access tokens once they expire.

The [Renew Tokens Endpoint](#get-authrenew) must be used for issuing new access tokens.

If a refresh token is believed to be leaked, user can request all refresh tokens to be invalidated through [Logout Endpoint](#get-authlogout). This ensures that previously issued refresh tokens cannot be used to issue new access tokens. However, previously issued access tokens remain valid for the rest of their lifespan.

### Access Scopes

Access scopes can only be granted upon registration. Both scopes listed below can be requested by providing the `admin` field in the [Signup Request](#signup-request):
  - `user-management`: Grants access to all endpoints which perform user management operations.
  - `inventory-management`: Grants access to all endpoints which perform inventory management operations.

## User Management

Users can manage their own account with the following endpoints:
  - [Profile Endpoint](#get-userprofile): Used to retrieve user profile information.
  - [Update Profile Endpoint](#post-userupdate): Used to update profile information.
  - [Delete Account Endpoint](#delete-userdelete): Used to delete user account and all its information.
  - [Credits Endpoint](#post-usercredits): Used to add credits to user account.

The following endpoints can be used by a user with the `user-management` access scope to manage other user's accounts:
  - [List Users Endpoint](#get-userlist): Used to retrieve a list of registered users.
  - [User Profile Endpoint](#get-useridprofile): Used to retrieve a user profile information.
  - [Update User Profile Endpoint](#post-useridupdate): Used to update a user profile information.
  - [Delete User Account Endpoint](#delete-useriddelete): Used to delete a user account and all its information.
  - [User Credits Endpoint](#post-useridcredits): Used to adjust credits for a user account.

## Games

The following endpoints are open to all anonymous users:
  - [Query Games Endpoint](#get-gamesquery): Used for querying the games in the inventory.
  - [New Games Endpoint](#get-gameslistnew): Used for getting a list of new games.
  - [Best Deals Endpoint](#get-gameslistbest): Used for getting a list of games with the highest sales.
  - [Popular Games Endpoint](#get-gameslistpopular): Used for getting a list of games with the highest popularity score.
  - [Random Games Endpoint](#get-gameslistrandom): Used for getting a list of random games.
  - [Game Info Endpoint](#get-gamesid): Used for retrieving a game information.
  - [Game Short Info Endpoint](#get-gamesshortid): Used for retrieving a short information of a game.

## Inventory Management

The game inventory can be managed using some `/games` endpoints by any users who possess the `inventory-management` access scope.

### Managing Games

The following endpoints can be used to manage the games:
  - [New Game Endpoint](#post-gamesnew): Used to add a new game to the inventory.
  - [Update Game Endpoint](#post-gamesidupdate): Used to update the price of a game in the inventory.
  - [Delete Game Endpoint](#delete-gamesiddelete): Used to delete a game in the inventory.
  - [IGDB Query Endpoint](#get-gamesigdbquery): Used to query the IGDB database prior to adding a new game.

### Managing Codes

Digital game codes can be managed through the following endpoints:
  - [Add Game Codes Endpoint](#post-gamesidcode): Used to add game codes to a game in the inventory.
  - [Delete Game Code Endpoint](#delete-gamesidcode): Used to delete a specific game code from a game in the inventory.

## Purchases

Purchases can be made by authenticated users using the [Purchase Game Endpoint](#get-gamesidpurchase).

### Purchase History

A user's purchase history can be retrieved by using the following endpoints:
  - [Purchase Info](#get-purchaseid): Used to retrieve a specific purchase info.
  - [Purchase History](#get-purchasehistory): Used to retrieve all purchase info.

The [Purchase Info](#get-purchaseid) can also be used by a user with `user-management` access scope to retrieve purchase information of another user, alongside the following endpoint:
  - [User Purchase History](#get-purchaseidhistory): Used to retrieve all purchase info of a specific user.

### Refunds

Refunds will only be issued when requested by the buyer and if the purchased game code is not yet [revealed](#revealing-codes) in their library:
  - [Refund Purchase Endpoint](#post-purchaseidrefund): Used for refunding a purchase.

## User Library

The user library contains information about the games and the unrevealed game codes they have purchased. This information can only be requested by the owner and not the admins:
  - [Library Endpoint](#get-library): Used for retrieving user library info.

### Revealing Codes

Once a game code is purchased by a user, it will be held unrevealed in their library, giving them a chance to refund the code before revealing it. The following endpoint should be used to reveal a purchased game code and add it to the games in user library (in-accessible to admins):
  - [Reveal Game Code Endpoint](#get-librarycodeid): Used to reveal a purchased game code.

## API Reference

### Endpoints

All endpoints respond in JSON format. If an error occurs, the response would be a [Error Response](#error-response).

---

#### GET /auth/login

Uses basic authentication to login users.

**Headers**:
  - Authorization: Basic

**Response**: [Full Token Response](#full-token-response)

---

#### POST /auth/signup

Registers new users.

**Headers**:
  - Content-Type: application/json

**Body**: [Signup Request](#signup-request)

**Response**: [Full Token Response](#full-token-response)

---

#### GET /auth/verify/send

Sends a verification email.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [Message Response](#message-response)

---

#### GET /auth/verify/complete

Completes user verification.

**Query Parameters**:
  - vt: Verification token

**Response**: [Message Response](#message-response)

---

#### POST /auth/reset/send

Sends a password reset email containing a code.

**Headers**:
  - Content-Type: application/json

**Body**: [Password Reset Email Request](#password-reset-email-request)

**Response**: [Message Response](#message-response)

---

#### POST /auth/reset/complete

Completes password reset.

**Headers**:
  - Content-Type: application/json

**Body**: [Password Reset Request](#password-reset-request)

**Response**: [Message Response](#message-response)

---

#### GET /auth/renew

Completes password reset.

**Headers**:
  - Authorization: Bearer (refresh token)

**Response**: [Access Token Response](#access-token-response)

---

#### GET /auth/logout

Logs out the user from all devices.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [Message Response](#message-response)

---

#### GET /user/profile

Returns the user profile information.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [User Profile Response](#user-profile-response)

---

#### POST /user/update

Updates the user profile.

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Body**: [User Update Request](#user-update-request)

**Response**: [Message Response](#message-response)

---

#### POST /user/credits

Adds user credits.

**Account Restriction**: Must be verified

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Body**: [Credits Update Request](#credits-update-request)

**Response**: [Message Response](#message-response)

---

#### DELETE /user/delete

Deletes user data.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [Message Response](#message-response)

---

#### GET /user/list

Returns a list of registered users.

**Account Restriction**: Must be verified

**Access Scopes**: `user-management`

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [User Listing Response](#user-listing-response)

---

#### GET /user/:id/profile

Returns a specific user's profile information.

**Account Restriction**: Must be verified

**Access Scopes**: `user-management`

**Headers**:
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The user id.

**Response**: [User Profile Response](#user-profile-response)

---

#### GET /user/:id/update

Update a specific user's profile information.

**Account Restriction**: Must be verified

**Access Scopes**: `user-management`

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The user id.

**Body**: [User Update Request](#user-update-request)

**Response**: [Message Response](#message-response)

---

#### POST /user/:id/credits

Adjusts a specific user's credits.

**Account Restriction**: Must be verified

**Access Scopes**: `user-management`

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The user id.

**Body**: [Credits Update Request](#credits-update-request)

**Response**: [Message Response](#message-response)

---

#### DELETE /user/:id/delete

Deletes a specific user's data.

**Account Restriction**: Must be verified

**Access Scopes**: `user-management`

**Headers**:
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The user id.

**Response**: [Message Response](#message-response)

---

#### GET /library

Returns the library data.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [Library Response](#library-response)

---

#### GET /library/code/:id

Reveals a purchased game code, making it not refundable.

**Account Restriction**: Must be verified

**Headers**:
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The unrevealed code ID.

**Response**: [Game Code Response](#game-code-response)

---

#### GET /purchase/history

Returns the purchase history.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [Purchase History Response](#purchase-history-response)

---

#### GET /purchase/:id

Returns a specific purchase data.

**Headers**:
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The purchase ID.

**Response**: [Purchase Response](#purchase-response)

---

#### GET /purchase/:id/refund

Refunds a specific purchase.

**Account Restriction**: Must be verified

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The purchase ID.

**Body**: [Refund Request](#refund-request)

**Response**: [Message Response](#message-response)

---

#### GET /purchase/:id/history

Returns a specific user's purchase history.

**Account Restriction**: Must be verified

**Access Scopes**: `user-management`

**Headers**:
  - Authorization: Bearer (access token)

**Parameters**:
  - id: The user id.

**Response**: [Purchase History Response](#purchase-history-response)

---

#### GET /games/query

Returns a list of game info.

**Query Parameters**:
  - q: A string query.

**Response**: [Short Game Info List Response](#short-game-info-list-response)

---

#### GET /games/list/new

Returns a list of game info of the newest games.

**Query Parameters**:
  - count: The number of games to return.

**Response**: [Short Game Info List Response](#short-game-info-list-response)

---

#### GET /games/list/best

Returns a list of game info of the games with best sales.

**Query Parameters**:
  - count: The number of games to return.

**Response**: [Short Game Info List Response](#short-game-info-list-response)

---

#### GET /games/list/popular

Returns a list of game info of the most popular games.

**Query Parameters**:
  - count: The number of games to return.

**Response**: [Short Game Info List Response](#short-game-info-list-response)

---

#### GET /games/list/random

Returns a list of game info of random games.

**Query Parameters**:
  - count: The number of games to return.

**Response**: [Short Game Info List Response](#short-game-info-list-response)

---

#### GET /games/:id

Returns a specific game's full info.

**Parameters**:
  - id: The game ID.

**Response**: [Game Info Response](#game-info-response)

---

#### GET /games/short/:id

Returns a specific game's short info.

**Parameters**:
  - id: The game ID.

**Response**: [Short Game Info Response](#short-game-info-response)

---

#### GET /games/:id/purchase

Purchases a specific game.

**Account Restriction**: Must be verified

**Parameters**:
  - id: The game ID.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [Message Response](#message-response)

---

#### GET /games/igdb/query

Queries games from IGDB.

**Account Restriction**: Must be verified

**Access Scopes**: `inventory-management`

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [IGDB Info Response](#igdb-info-response)

---

#### POST /games/new

Adds a new game.

**Account Restriction**: Must be verified

**Access Scopes**: `inventory-management`

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Body**: [New Game Request](#new-game-request)

**Response**: [Game Added Response](#game-added-response)

---

#### POST /games/:id/code

Adds game codes for selling.

**Account Restriction**: Must be verified

**Access Scopes**: `inventory-management`

**Parameters**:
  - id: The game ID.

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Body**: [Add Game Codes Request](#add-game-codes-request)

**Response**: [Message Response](#message-response)

---

#### DELETE /games/:id/code

Deletes a specific game code from a game.

**Account Restriction**: Must be verified

**Access Scopes**: `inventory-management`

**Parameters**:
  - id: The game ID.

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Body**: [Delete Game Code Request](#delete-game-code-request)

**Response**: [Message Response](#message-response)

---

#### DELETE /games/:id/delete

Deletes a game.

**Account Restriction**: Must be verified

**Access Scopes**: `inventory-management`

**Parameters**:
  - id: The game ID.

**Headers**:
  - Authorization: Bearer (access token)

**Response**: [Message Response](#message-response)

---

#### POST /games/:id/update

Updates a specific game's prices.

**Account Restriction**: Must be verified

**Access Scopes**: `inventory-management`

**Parameters**:
  - id: The game ID.

**Headers**:
  - Content-Type: application/json
  - Authorization: Bearer (access token)

**Body**: [Update Game Request](#update-game-request)

**Response**: [Message Response](#message-response)

---

#### GET /image/:filename

Serves static images in the `/src/images` directory.

**Parameters**:
  - filename: The image filename.

**Response**: Binary

### Data Models

#### Signup Request

```ts
interface {
  firstName: string;
  lastName: string;
  dob: string;        // Must be in mm-dd-yyyy or m-d-yyyy formats
  email: string;
  password: string;   // Must contain one lowercase and one uppercase alphabetic
                      // character, one digit, and one special character
                      // Must be between 8 to 32 characters long
  admin?: boolean;    // Whether to grant this user all access scopes or not
}
```

#### Password Reset Email Request

```ts
interface {
  email: string;
}
```

#### Password Reset Request

```ts
interface {
  email: string;
  newPassword: string;  // Must contain one lowercase and one uppercase alphabetic
                        // character, one digit, and one special character
                        // Must be between 8 to 32 characters long
  code: string;
}
```

#### User Update Request

```ts
interface {
  firstName: string;
  lastName: string;
  dob: string;
}
```

#### Credits Update Request

```ts
interface {
  adjustBy: number;   // Must be a positive number when 'user-management'
                      // access scope is not present
}
```

#### Refund Request

```ts
interface {
  reason?: string;
}
```

#### New Game Request

```ts
interface {
  igdbId: number;
  price: number;
  salePrice?: number;
  client: string;         // GameClient enum
}
```

#### Add Game Codes Request

```ts
interface {
  codes: string[]
}
```

#### Delete Game Code Request

```ts
interface {
  code: string;
}
```

#### Update Game Request

```ts
interface {
  price?: number;
  salePrice?: number;
}
```

#### Message Response

```ts
interface {
  message: string;
}
```

#### Error Response

```ts
interface {
  error: true;
  message: string;
}
```

#### Access Token Response

```ts
interface {
  access: string;
}
```

#### Full Token Response

```ts
interface {
  refresh: string;
  access: string;
}
```

#### User Profile Response

```ts
interface {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  credits: number;
  verified: boolean;
  accessScopes: string[];   // Can contain 'inventory-management' and 'user-management'
  createdAt: number;
  updatedAt: number;
}
```

#### User Listing Response

```ts
interface {
  id: string;
  verified: boolean;
  firstName: string;
  lastName: string;
  email: string;
  accessScopes: string[];
}[]
```

#### Library Response

```ts
interface {
  games: {
    gameId: string;
    code: string;
  }[];
  unrevealedCodes: {
    id: string;
    gameId: string;
  }[];
  createdAt: number;
  updatedAt: number;
}
```

#### Game Code Response

```ts
interface {
  gameId: string;
  code: string;
}
```

#### Purchase History Response

```ts
interface {
  id: string;
  buyer: string;
  codeId: string;
  gameId: string;
  originalPrice: number;
  finalPrice: number;
  refunded?: boolean;
  reason?: string;
  createdAt: number;
  updatedAt: number;
}[]
```

#### Purchase Response

```ts
interface {
  id: string;
  buyer: string;
  codeId: string;
  gameId: string;
  originalPrice: number;
  finalPrice: number;
  refunded?: boolean;
  reason?: string;
  createdAt: number;
  updatedAt: number;
}
```

#### Short Game Info List Response

```ts
interface {
  id: string;
  igdbId: number;
  title: string;
  firstReleaseDate?: number;  // Milliseconds since Epoch.
  coverUrl: string;
  thumbnailUrl: string;
  popularity?: number;        // Popularity score
  client: string;             // GameClient enum
  saleRatio: number;          // Sale price ratio (0-1)
}[]
```

#### Game Info Response

```ts
interface {
  id: string;
  igdbId: number;
  title: string;
  summary?: string;
  storyline?: string;
  firstReleaseDate?: number;  // Seconds since Epoch.
  rating: number;             // Rating out of 100
  ratingCount: number;
  popularity?: number;        // Popularity score
  category: string;
  client: string;             // GameClient enum
  saleRatio: number;          // Sale price ratio (0-1)
  price: number;
  salePrice: number;
  genres?: string[];
  coverUrl?: string;
  thumbnailUrl?: string;
  headerUrl?: string;
  screenshotUrls?: {
    small: string;
    large: string;
  }[];
  ageRatings?: {
    organization: string;     // Either PEGI or ESRB
    label: string;
    age: number;              // The actual age threshold
  }[];
  similarGames?: {
    title: string;
    igdbId: number;
    thumbnailUrl?: string;
  }[];
  updatedAt: number;
  createdAt: number;
}
```

#### Short Game Info Response

```ts
interface {
  id: string;
  igdbId: number;
  title: string;
  firstReleaseDate?: number;  // Seconds since Epoch.
  coverUrl: string;
  thumbnailUrl: string;
  popularity?: number;        // Popularity score
  client: string;             // GameClient enum
  saleRatio: number;          // Sale price ratio (0-1)
}
```

#### IGDB Info Response

```ts
interface {
  igdbId: number;
  title: string;
  thumbnailUrl?: string;
  firstReleaseDate?: number;  // Seconds since Epoch.
}
```

#### Game Added Response

```ts
interface {
  id: string;
  message: string;
}
```
