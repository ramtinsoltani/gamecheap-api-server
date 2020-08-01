import { BaseServerConfig } from './@steroids/models';

export interface ServerConfig extends BaseServerConfig {

  // Extend config here
  hostUrl: string;
  token: {
    accessSecret: string;
    refreshSecret: string;
    verificationSecret: string;
    accessLifespan: number;
    refreshLifespan: number;
  };
  database: {
    host: string,
    port: number,
    db: string
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    senderName: string;
    senderEmail: string;
  };
  igdb: {
    token: string;
    host: string;
    endpoints: {
      games: string;
      genres: string;
      covers: string;
      screenshots: string;
      ageRatings: string;
    };
    dataTemplates: {
      games: string;
      gamesShort: string;
      gamesQuery: string;
      genres: string;
      covers: string;
      screenshots: string;
      ageRatings: string;
    };
    urlTemplates: {
      covers: string;
      thumbnails: string;
      screenshotsLarge: string;
      screenshotsSmall: string;
      headers: string;
    };
  };
  maxmind: {
    dbLink: string;
    key: string;
  };

}
