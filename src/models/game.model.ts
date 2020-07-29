import { Schema, Document, model } from 'mongoose';

const GameSchema = new Schema({
  igdbId: Number,
  client: String,
  price: Number,
  salePrice: Number,
  codes: [String],
  codesCount: Number,
  createdAt: Number,
  updatedAt: Number,
  title: String,
  coverUrl: String,
  thumbnailUrl: String,
  headerUrl: String,
  summary: String,
  storyline: String,
  status: String,
  category: String,
  screenshotUrls: [{
    large: String,
    small: String
  }],
  ageRatings: [{
    label: String,
    organization: String,
    age: Number
  }],
  genres: [String],
  firstReleaseDate: Number,
  rating: Number,
  ratingCount: Number,
  similarGames: [{
    igdbId: Number,
    title: String,
    thumbnailUrl: String
  }],
  popularity: Number,
  saleRatio: Number
});

// Pre save hook sets updatedAt, createdAt, and codesCount fields
GameSchema.pre<GameDocument>('save', function() {

  const timestamp = Math.floor(Date.now() / 1000);

  this.createdAt = this.createdAt || timestamp;
  this.updatedAt = timestamp;
  this.codesCount = this.codes?.length || 0;

});

export interface GameDocument extends Document, GameInfoFull {

  /** The game client/platform which the codes belong to. */
  client: GameClient;
  /** The price of the game. */
  price: number;
  /** The sale price of the game. */
  salePrice?: number;
  /** A list of game codes to sell. */
  codes: Array<string>;
  /** Document creation time. */
  createdAt: number;
  /** Last document update time. */
  updatedAt: number;

}

export enum GameClient {

  Steam = 'steam',
  Origin = 'origin',
  Gog = 'gog',
  BattleNet = 'battle-net',
  EpicGames = 'epic-games',
  Uplay = 'uplay',
  Bethesda = 'bethesda',
  Rockstar = 'rockstar',
  MicrosoftStore = 'microsoft-store',
  Playstation = 'playstation',
  Switch = 'switch',
  Xbox = 'xbox'

}

export interface GameInfoShort {

  /** The IGDB ID of the game. */
  igdbId: number;
  /** The game title. */
  title: string;
  /** A URL to game thumbnail image. */
  thumbnailUrl: string;
  /** A URL to game cover image. */
  coverUrl: string;
  /** The first release date of the game in milliseconds since Epoch. */
  firstReleaseDate?: number;
  /** A popularity score from 0 to 100. */
  popularity?: number;
  /** The game client/platform which the codes belong to. */
  client: GameClient;
  /** Game price sale ratio. */
  saleRatio: number;

}

export interface GameInfo extends GameInfoShort {

  /** Game summary. */
  summary?: string;
  /** Game storyline. */
  storyline?: string;
  /** The release status of the game. */
  status?: string;
  /** The game release category (main game, dlc, mod, etc.). */
  category: string;
  /** List of URLs to screenshot images. */
  screenshotUrls?: Array<{
    /** Large size screenshot URL. */
    large: string;
    /** Small size screenshot URL. */
    small: string;
  }>;
  /** List of age ratings for this game from various organizations. */
  ageRatings: Array<{
    /** The rating label. */
    label: string;
    /** The organization name where this rating is from. */
    organization: string;
    /** The age threshold of the rating. */
    age: number;
  }>;
  /** A list of genres. */
  genres: string[];
  /** The review score. */
  rating: number;
  /** The number of reviewers. */
  ratingCount: number;
  /** A list of short info for similar games. */
  similarGames?: Array<GameInfoShort>;
  /** A URL to game header image. */
  headerUrl: string;

}

export interface GameInfoFull extends GameInfo {

  /** The price of the game. */
  price: number;
  /** The sale price of the game. */
  salePrice?: number;
  /** Document creation time. */
  createdAt: number;
  /** Last document update time. */
  updatedAt: number;
  /** The number of codes available to sell. */
  codesCount: number;

}

export interface IGDBGameDataShort {

  id: number;
  name: string;
  cover: number;
  first_release_date?: number;

}

export interface IGDBGameData extends IGDBGameDataShort {

  summary?: string;
  storyline?: string;
  status: GameStatus;
  category: GameCategory;
  age_ratings: number[];
  genres: number[];
  total_rating: number;
  total_rating_count: number;
  first_release_date?: number;
  screenshots?: number[];
  similar_games?: number[];
  popularity?: number;

}

export interface IGDBAgeRatingData {

  category: number;
  rating: number;

}

export interface IGDBGenreData {

  name: string;

}

export interface IGDBImageData {

  image_id: string;

}

export type IGDBResponse<T> = Array<T>;

export enum GameCategory {

  'Main Game',
  'DLC Addon',
  Expansion,
  Bundle,
  'Standalone Expansion',
  Mod,
  Episode

}

export enum GameStatus {

  Released = 0,
  Alpha = 2,
  Beta,
  'Early Access',
  Offline,
  Cancelled,
  Rumored

}

export enum AgeRatingOrganization {

  ESRB = 1,
  PEGI

}

export enum AgeRating {

  Three = 1,
  Seven,
  Twelve,
  Sixteen,
  Eighteen,
  RP,
  EC,
  E,
  E10,
  T,
  M,
  AO,

}

export const AgeRatingThresholds = [null, 3, 7, 12, 16, 18, 0, 3, 6, 10, 13, 17, 18];

export default model<GameDocument>('games', GameSchema);
