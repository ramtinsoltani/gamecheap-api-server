import { Service, OnConfig, OnInjection, ServerConfig, ServerError } from '@steroids/core';
import axios from 'axios';
import mustache from 'mustache';
import Fuse from 'fuse.js';
import maxmind, { CountryResponse, Reader } from 'maxmind';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import targz from 'targz';

import { AxiosInstance } from 'axios';
import {
  IGDBGameData,
  IGDBGameDataShort,
  IGDBImageData,
  IGDBGenreData,
  IGDBAgeRatingData,
  IGDBResponse,
  GameInfo,
  GameInfoShort,
  GameStatus,
  GameCategory,
  AgeRating,
  AgeRatingOrganization,
  AgeRatingThresholds
} from '@steroids/model/game';
import { NewGameRequest, UpdateGameRequest } from '@steroids/router/games';
import { Types } from 'mongoose';

import GameModel from '@steroids/model/game';
import UserModel from '@steroids/model/user';
import PurchaseModel from '@steroids/model/purchase';
import LibraryModel from '@steroids/model/library';

import { TasksService } from '@steroids/service/tasks';

@Service({
  name: 'games'
})
export class GamesService implements OnConfig, OnInjection {

  private igdbConfig: ServerConfig['igdb'];
  private maxmindConfig: ServerConfig['maxmind'];
  private igdbApi: AxiosInstance;
  private tasks: TasksService;
  private ipDatabaseReady: boolean = false;
  private IP_DATABASE_PATH = path.resolve(os.homedir(), '.gamecheap', 'maxmind-country.mmdb');
  private ipDatabase: Reader<CountryResponse>;

  onInjection(services: any) {

    this.tasks = services.tasks;

  }

  onConfig(config: ServerConfig) {

    this.igdbConfig = config.igdb;
    this.igdbApi = axios.create({
      baseURL: this.igdbConfig.host,
      headers: {
        Accept: 'application/json',
        'content-type': 'text/plain',
        'user-key': this.igdbConfig.token
      },
      validateStatus: null
    });
    this.maxmindConfig = config.maxmind;

    this.init();

  }

  /**
  * Registers tasks.
  */
  init() {

    this.tasks.events.on('ready', () => {

      // Run weekly
      this.tasks.register('maxmind-update', 7 * 24 * 60 * 60, true, async data => {

        if ( data.lastUpdated && Date.now() - data.lastUpdated < 7 * 24 * 60 * 60 * 1000 ) {

          log.notice('Maxmind database is already updated');
          return;

        }

        log.notice('Updating Maxmind database...');

        this.ipDatabaseReady = false;

        // Delete old .mmdb
        await fs.remove(this.IP_DATABASE_PATH);

        const downloadLink = mustache.render(this.maxmindConfig.dbLink, { key: this.maxmindConfig.key });
        const response = await axios.get(downloadLink, { responseType: 'stream' });
        const gzWriter = fs.createWriteStream(this.IP_DATABASE_PATH + '.tar.gz');
        let hadError = false;

        // Write .mmdb.gz file
        await new Promise((resolve, reject) => {

          response.data
          .pipe(gzWriter)
          .on('error', (error: Error) => {

            hadError = true;
            gzWriter.close();
            reject(error);

          })
          .on('close', () => {

            if ( ! hadError ) resolve();

          });

        });

        // Unzip to .mmdb
        await new Promise((resolve, reject) => {

          targz.decompress({
            src: this.IP_DATABASE_PATH + '.tar.gz',
            dest: this.IP_DATABASE_PATH
          }, error => {

            if ( error ) reject(error);
            else resolve();

          });

        });

        // Move .mmdb file outside of directory
        const contentDirName = (await fs.readdir(this.IP_DATABASE_PATH))[0];
        const contentMmdbName = (await fs.readdir(path.resolve(this.IP_DATABASE_PATH, contentDirName)))
        .filter(filename => filename.substr(-5).toLowerCase() === '.mmdb')[0];

        await fs.move(path.resolve(this.IP_DATABASE_PATH, contentDirName, contentMmdbName), this.IP_DATABASE_PATH + '.temp');
        await fs.remove(this.IP_DATABASE_PATH);
        await fs.rename(this.IP_DATABASE_PATH + '.temp', this.IP_DATABASE_PATH);

        // Delete .mmdb.gz
        await fs.remove(this.IP_DATABASE_PATH + '.tar.gz');

        data.lastUpdated = Date.now();

        log.notice('Maxmind database updated');

      });

      this.tasks.events.on('maxmind-update:error', (error: Error) => {

        log.error(`Task "maxmind-update" failed:`, error);

      });

      this.tasks.events.on('maxmind-update:after', async () => {

        this.ipDatabase = await maxmind.open<CountryResponse>(this.IP_DATABASE_PATH);

        this.ipDatabaseReady = true;

      });

    });

  }

  /**
  * Calculates age from a date of birth.
  * @param dob The date of birth string.
  */
  private calculateAge(dob: string): number {

    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();

    if ( m < 0 || (m === 0 && today.getDate() < birthDate.getDate()) ) age--;

    return age;

  }

  /**
  * Retrieves short information from IGDB.
  * @param id The IGDB ID of the game.
  */
  private async getIGDBShortInfo(id: number): Promise<GameInfoShort> {

    const info: Partial<GameInfoShort> = {};

    // Get limited short from IGDB
    const gamesResponse = await this.igdbApi.post<IGDBResponse<IGDBGameDataShort>>(
      this.igdbConfig.endpoints.games,
      mustache.render(this.igdbConfig.dataTemplates.gamesShort, { id })
    );

    if ( gamesResponse.status !== 200 || ! gamesResponse.data.length )
      throw new ServerError('Could not process request at this time!', 'igdb-error');

    const gamesData = gamesResponse.data[0];

    info.title = gamesData.name;
    info.igdbId = gamesData.id;
    info.firstReleaseDate = gamesData.first_release_date;

    // Get cover
    if ( gamesData.cover ) {

      const coversResponse = await this.igdbApi.post<IGDBResponse<IGDBImageData>>(
        this.igdbConfig.endpoints.covers,
        mustache.render(this.igdbConfig.dataTemplates.covers, { id: gamesData.cover })
      );

      if ( coversResponse.status !== 200 )
        throw new ServerError('Could not process request at this time!', 'igdb-error');

      if ( coversResponse.data.length ) {

        const coversData = coversResponse.data[0];

        // Construct the thumbnail url
        info.thumbnailUrl = mustache.render(this.igdbConfig.urlTemplates.thumbnails, { id: coversData.image_id });

      }

    }

    return <GameInfoShort>info;

  }

  /**
  * Retrieves game information from IGDB.
  * @param id The IGDB ID of the game.
  */
  private async getIGDBInfo(id: number): Promise<GameInfo> {

    const info: Partial<GameInfo> = {};

    // Get game info from IGDB
    const gamesResponse = await this.igdbApi.post<IGDBResponse<IGDBGameData>>(
      this.igdbConfig.endpoints.games,
      mustache.render(this.igdbConfig.dataTemplates.games, { id })
    );

    if ( gamesResponse.status !== 200 || ! gamesResponse.data.length )
      throw new ServerError('Could not process request at this time!', 'igdb-error');

    const gamesData = gamesResponse.data[0];
    let coverId: string, screenshotId: string;

    // Set game info
    info.title = gamesData.name;
    info.category = GameCategory[gamesData.category];
    info.status = GameStatus[gamesData.status];
    info.summary = gamesData.summary;
    info.storyline = gamesData.storyline;
    info.firstReleaseDate = gamesData.first_release_date;
    info.rating = gamesData.total_rating;
    info.ratingCount = gamesData.total_rating_count;
    info.similarGames = [];
    info.popularity = gamesData.popularity;

    // Get cover
    if ( gamesData.cover ) {

      const coversResponse = await this.igdbApi.post<IGDBResponse<IGDBImageData>>(
        this.igdbConfig.endpoints.covers,
        mustache.render(this.igdbConfig.dataTemplates.covers, { id: gamesData.cover })
      );

      if ( coversResponse.status !== 200 )
        throw new ServerError('Could not process request at this time!', 'igdb-error');

      if ( coversResponse.data.length ) {

        const coversData = coversResponse.data[0];

        // Construct the cover url
        info.coverUrl = mustache.render(this.igdbConfig.urlTemplates.covers, { id: coversData.image_id });
        // Construct the thumbnail url
        info.thumbnailUrl = mustache.render(this.igdbConfig.urlTemplates.thumbnails, { id: coversData.image_id });

        coverId = coversData.image_id;

      }

    }

    // Get screenshots
    if ( gamesData.screenshots?.length ) {

      const screenshotsResponse = await this.igdbApi.post<IGDBResponse<IGDBImageData>>(
        this.igdbConfig.endpoints.screenshots,
        mustache.render(this.igdbConfig.dataTemplates.screenshots, { ids: gamesData.screenshots.join(',') })
      );

      if ( screenshotsResponse.status !== 200 )
        throw new ServerError('Could not process request at this time!', 'igdb-error');

      // Construct the cover url
      info.screenshotUrls = screenshotsResponse.data.map(data => ({
        large: mustache.render(this.igdbConfig.urlTemplates.screenshotsLarge, { id: data.image_id }),
        small: mustache.render(this.igdbConfig.urlTemplates.screenshotsSmall, { id: data.image_id })
      }));

      if ( screenshotsResponse.data.length ) screenshotId = screenshotsResponse.data[0].image_id;

    }

    // Construct the header URL
    if ( screenshotId || coverId )
      info.headerUrl = mustache.render(this.igdbConfig.urlTemplates.headers, { id: screenshotId || coverId });

    // Get genres
    if ( gamesData.genres?.length ) {

      const genresResponse = await this.igdbApi.post<IGDBResponse<IGDBGenreData>>(
        this.igdbConfig.endpoints.genres,
        mustache.render(this.igdbConfig.dataTemplates.genres, { ids: gamesData.genres.join(',') })
      );

      if ( genresResponse.status !== 200 )
        throw new ServerError('Could not process request at this time!', 'igdb-error');

      info.genres = genresResponse.data.map(data => data.name);

    }

    // Get age ratings
    if ( gamesData.age_ratings?.length ) {

      const ageRatingsResponse = await this.igdbApi.post<IGDBResponse<IGDBAgeRatingData>>(
        this.igdbConfig.endpoints.ageRatings,
        mustache.render(this.igdbConfig.dataTemplates.ageRatings, { ids: gamesData.age_ratings.join(',') })
      );

      if ( ageRatingsResponse.status !== 200 )
        throw new ServerError('Could not process request at this time!', 'igdb-error');

      info.ageRatings = ageRatingsResponse.data.map(rating => ({
        organization: AgeRatingOrganization[rating.category],
        label: AgeRating[rating.rating],
        age: AgeRatingThresholds[rating.rating]
      }));

    }

    // Get similar games
    if ( gamesData.similar_games?.length ) {

      for ( const id of gamesData.similar_games ) {

        info.similarGames.push(await this.getIGDBShortInfo(id));

      }

    }

    return <GameInfo>info;

  }

  /**
  * Retrieves game info from the database.
  * @param id The game ID.
  */
  public async getGameInfo(id: string) {

    const game = await GameModel.findById(id, '-__v -ageRatings._id -screenshotUrls._id -similarGames._id -codes').exec();

    if ( ! game ) throw new ServerError('Game not found!', 'game-info-error');

    // Sanitize the output
    return Object.assign(game.toJSON(), {
      _id: undefined,
      id: game._id
    });

  }

  /**
  * Retrieves short game info from the database.
  * @param id The game ID.
  */
  public async getGameShortInfo(id: string): Promise<GameInfoShort> {

    const game = await GameModel.findById(id, {
      _id: 1,
      title: 1,
      firstReleaseDate: 1,
      coverUrl: 1,
      thumbnailUrl: 1,
      igdbId: 1,
      popularity: 1,
      saleRatio: 1,
      client: 1
    }).exec();

    if ( ! game ) throw new ServerError('Game not found!', 'game-info-error');

    return Object.assign(game.toJSON(), {
      _id: undefined,
      id: game._id
    });

  }

  /**
  * Queries the games by title.
  * @param query The query.
  */
  public async queryGames(query: string): Promise<Array<GameInfoShort>> {

    // Escape query for regex syntax
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Construct regular expression
    const regex = new RegExp(safeQuery.replace(' ', '.*'), 'i');

    // Query the database
    const results = await GameModel.find({ title: regex }, {
      _id: 1,
      title: 1,
      firstReleaseDate: 1,
      coverUrl: 1,
      thumbnailUrl: 1,
      igdbId: 1,
      popularity: 1,
      saleRatio: 1,
      client: 1
    }).exec();

    // Generate fuzzy search scores to sort the results
    const fuse = new Fuse(results, {
      keys: ['title'],
      includeScore: true,
      findAllMatches: true,
      threshold: 1
    });

    return fuse.search(safeQuery).map(result => ({
      ...result.item.toJSON(),
      _id: undefined,
      id: result.item._id
    }));

  }

  /**
  * Queries IGDB and retrieves short game information.
  * @param query The query string.
  */
  public async queryIGDB(query: string): Promise<Array<GameInfoShort>> {

    const results: Array<GameInfoShort> = [];

    const queryResponse = await this.igdbApi.post<IGDBResponse<IGDBGameDataShort>>(
      this.igdbConfig.endpoints.games,
      mustache.render(this.igdbConfig.dataTemplates.gamesQuery, { query })
    );

    if ( queryResponse.status !== 200 )
      throw new ServerError('Could not process request at this time!', 'igdb-error');

    for ( const response of queryResponse.data ) {

      const result: Partial<GameInfoShort> = {};

      result.title = response.name;
      result.igdbId = response.id;
      result.firstReleaseDate = response.first_release_date;

      // Get cover
      if ( response.cover ) {

        const coversResponse = await this.igdbApi.post<IGDBResponse<IGDBImageData>>(
          this.igdbConfig.endpoints.covers,
          mustache.render(this.igdbConfig.dataTemplates.covers, { id: response.cover })
        );

        if ( coversResponse.status !== 200 )
          throw new ServerError('Could not process request at this time!', 'igdb-error');

        if ( coversResponse.data.length ) {

          const coversData = coversResponse.data[0];

          // Construct the thumbnail url
          result.thumbnailUrl = mustache.render(this.igdbConfig.urlTemplates.thumbnails, { id: coversData.image_id });

        }

      }

      results.push(<GameInfoShort>result);

    }

    return results;

  }

  /**
  * Adds a new game to the inventory.
  * @param info The game info.
  */
  public async addGame(info: NewGameRequest['body']): Promise<string> {

    // If game already exists
    const identicalGame = await GameModel.findOne({ igdbId: info.igdbId, client: info.client }).exec();

    if ( identicalGame ) throw new ServerError('Game already exists!', 'game-add-error');

    // Create new game document
    const game = new GameModel();

    game.igdbId = info.igdbId;
    game.price = info.price;
    game.salePrice = info.salePrice;
    game.saleRatio = 1 - (info.salePrice / info.price);
    game.codes = [];
    game.client = info.client;

    // Fetch game info from IGDB
    const fullInfo = await this.getIGDBInfo(info.igdbId);

    Object.assign(game, fullInfo);

    // Save game document
    const savedGame = await game.save();

    return savedGame._id;

  }

  /**
  * Updates an existing game document.
  * @param id A game ID.
  * @param info The update info.
  */
  public async updateGame(id: string, info: UpdateGameRequest['body']) {

    const game = await GameModel.findById(id).exec();

    if ( ! game ) throw new ServerError('Game not found!', 'game-update-error');

    // Update game info
    game.price = info.price || game.price;
    game.salePrice = info.salePrice || game.salePrice;

    // Save the document
    await game.save();

  }

  /**
  * Adds game codes to an existing game.
  * @param id The game ID.
  * @param codes The game codes to add.
  */
  public async addGameCode(id: string, codes: Array<string>) {

    const game = await GameModel.findById(id).exec();

    if ( ! game ) throw new ServerError('Game not found!', 'game-code-add-error');

    // Add game codes
    for ( const code of codes ) {

      if ( ! game.codes.includes(code) ) game.codes.push(code);

    }

    // Save the document
    await game.save();

  }

  /**
  * Deletes a game code from an existing game.
  * @param id The game ID.
  * @param code The game code to delete.
  */
  public async deleteGameCode(id: string, code: string) {

    const game = await GameModel.findById(id).exec();

    if ( ! game ) throw new ServerError('Game not found!', 'game-code-add-error');

    // Add game code
    const codeIndex = game.codes.indexOf(code);

    if ( codeIndex === -1 )
      throw new ServerError('Code not found!', 'game-code-delete-error');

    game.codes.splice(codeIndex, 1);

    // Save the document
    await game.save();

  }

  /**
  * Deletes a game document.
  * @param id The game ID.
  */
  public async deleteGame(id: string) {

    await GameModel.findByIdAndDelete(id);

  }

  /**
  * Makes a game purchase under the specified user account.
  * @param id The game ID.
  * @param uid The user ID.
  * @param ip The IP of the user.
  */
  public async purchaseGame(id: string, uid: string, ip: string): Promise<string> {

    // If IP database is being updated
    if ( ! this.ipDatabaseReady )
      throw new ServerError('Cannot purchase game at this time! Please try again later.', 'game-purchase-error');

    // Find user
    const user = await UserModel.findById(uid).exec();

    if ( ! user ) throw new ServerError('Unknown user!', 'game-purchase-error');

    // Find game
    const game = await GameModel.findById(id).exec();

    if ( ! game ) throw new ServerError('Game not found!', 'game-purchase-error');

    // Check user's age against game's age restrictions
    // Remove IPv6 prefix and convert to IPv4
    if ( ip.includes('::ffff:') ) ip = ip.substr(7);

    // If valid IP
    if ( maxmind.validate(ip) ) {

      // Calculate user age from date of birth
      const userAge = this.calculateAge(user.dob);

      // Get country by IP
      const location = this.ipDatabase.get(ip);
      // Get ratings
      const pegiRating = game.ageRatings.filter(rating => rating.organization === 'PEGI')[0];
      const esrbRating = game.ageRatings.filter(rating => rating.organization === 'ESRB')[0];

      // If PEGI rating must be applied and available
      if ( pegiRating && (location.continent.code === 'EU' || location.country.iso_code === 'IL') ) {

        if ( userAge < pegiRating.age )
          throw new ServerError('Cannot make the purchase due to game\'s age restrictions!', 'game-purchase-error');

      }
      // Otherwise apply ESRB (if available)
      else if ( esrbRating && location.continent.code !== 'EU' && location.country.iso_code !== 'IL' ) {

        if ( userAge < esrbRating.age )
          throw new ServerError('Cannot make the purchase due to game\'s age restrictions!', 'game-purchase-error');

      }

    }

    // Find library
    const library = await LibraryModel.findById(uid).exec();

    if ( ! library ) throw new ServerError('Missing library!', 'game-purchase-error');

    // Check if there's a game code available
    if ( ! game.codesCount ) throw new ServerError('No codes available to purchase!', 'game-purchase-error');

    // Check user credits against game price
    if ( user.credits < (game.salePrice || game.price) )
      throw new ServerError('Insufficient credits!', 'game-purchase-error');

    // Adjust user credits
    await user.updateOne({ credits: user.credits - (game.salePrice || game.price) });

    // Remove a game code
    const code = game.codes.shift();

    await game.save();

    // Add code to user library
    const codeId = new Types.ObjectId();

    library.unrevealedCodes.push({
      _id: codeId,
      code,
      gameId: id
    });

    await library.save();

    // Create purchase document
    const purchase = new PurchaseModel();

    purchase.buyer = uid;
    purchase.gameId = id;
    purchase.codeId = codeId;
    purchase.originalPrice = game.price;
    purchase.finalPrice = game.salePrice || game.price;

    await purchase.save();

    return purchase._id;

  }

  /**
  * Queries the the games by custom condition.
  * @param condition MongoDB find condition.
  * @param limit Query limit value.
  * @param sort Query sort field.
  * @param asc Sort order.
  */
  public async queryGamesCondition(condition: any, limit: number = 10, sort?: string, asc?: boolean): Promise<Array<GameInfoShort>> {

    let query = GameModel.find(condition, {
      _id: 1,
      title: 1,
      firstReleaseDate: 1,
      coverUrl: 1,
      thumbnailUrl: 1,
      igdbId: 1,
      popularity: 1,
      saleRatio: 1,
      client: 1
    })
    .limit(limit);

    if ( sort ) query = query.sort({ [sort]: asc ? 'ascending' : 'descending' });

    return (await query.exec())
    .map(result => ({
      ...result.toJSON(),
      _id: undefined,
      id: result._id
    }));

  }

  /**
  * Returns random games.
  * @param count The number of games to return.
  */
  public async getRandomGames(count: number): Promise<Array<GameInfoShort>> {

    const totalGames = await GameModel.countDocuments().exec();
    const results: Array<GameInfoShort> = [];
    const ids = [];

    for ( let i = 0; i < (totalGames < count ? totalGames : count); i++ ) {

      const unidenticalCount = await GameModel.find({ _id: { $nin: ids } }).countDocuments().exec();
      const skip = Math.floor(Math.random() * unidenticalCount);
      const doc = await GameModel.findOne({ _id: { $nin: ids } }, {
        _id: 1,
        title: 1,
        firstReleaseDate: 1,
        coverUrl: 1,
        thumbnailUrl: 1,
        igdbId: 1,
        popularity: 1,
        saleRatio: 1,
        client: 1
      }).skip(skip).exec();

      ids.push(doc._id);

      results.push(Object.assign(doc.toJSON(), { _id: undefined, id: doc._id }));

    }

    return results;

  }

}
