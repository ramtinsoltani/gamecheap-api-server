import { Service, OnConfig, ServerConfig } from '@steroids/core';
import mongoose from 'mongoose';

@Service({
  name: 'database'
})
export class DatabaseService implements OnConfig {

  private databaseConfig: ServerConfig['database'];

  async onConfig(config: ServerConfig) {

    this.databaseConfig = config.database;

    await this.init();

  }

  /**
  * Connects to MongoDb.
  */
  async init() {

    await mongoose.connect(`mongodb://${this.databaseConfig.host}:${this.databaseConfig.port}/${this.databaseConfig.db}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
      autoIndex: false
    });

  }

}
