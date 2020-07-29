// This script builds the app and starts the server
import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import express from 'express';
import bodyParser from 'body-parser';
import { DateTime } from 'luxon';
import serverConfig from '../config.json';
import * as tsConfigPaths from 'tsconfig-paths';
import paths from '../paths.json';
import { ServerLogger } from './logger';
import { RequestHandler, Request, Response, NextFunction } from 'express';

import {
  ServerError,
  BaseServerConfig,
  BasicModule,
  ModuleType,
  RouteDefinition,
  ValidationType,
  HeaderValidator,
  BodyValidator,
  ValidatorFunction,
  AsyncValidatorFunction,
  ValidationResult
} from './core';

// Register path alias resolver
tsConfigPaths.register({
  // If CWD is the dist folder, set the baseUrl to './', otherwise set it to './dist'
  baseUrl: './' + (fs.existsSync(path.resolve(process.cwd(), '@steroids')) ? '' : 'dist'),
  paths: paths
});

const CONFIG_DEFAULT: BaseServerConfig = {
  port: 5000,
  predictive404: false,
  predictive404Priority: Infinity,
  timezone: DateTime.local().zone.name,
  colorfulLogs: true,
  writeLogsToFile: true,
  logFileLevels: 'all',
  consoleLogLevels: ['info', 'notice', 'warn', 'error'],
  logFileMaxAge: 7,
  archiveLogs: true
};

// Override the config file
let config = _.assign(CONFIG_DEFAULT, serverConfig);

// Provide server logger globally
declare global {

  let log: ServerLogger;

}

(<any>global).log = new ServerLogger(config);

const app = express();
const services: any = {};
let routers: any = {};

function installModule(filename: string): void {

  if ( ! path.basename(filename).match(/^(.+)\.((service)|(router))\.js$/) ) return;

  const modules: any[] = _.values(require(path.join(__dirname, filename)));

  for ( const module of modules ) {

    if ( typeof module !== 'function' ) continue;

    try {

      const initializedModule: BasicModule = new module();

      if ( ! initializedModule.__metadata ) continue;

      if ( initializedModule.__metadata.type === ModuleType.Service ) {

        services[initializedModule.__metadata.name] = initializedModule;
        log.debug(`Service "${initializedModule.__metadata.name}" installed`);

      }
      else if ( initializedModule.__metadata.type === ModuleType.Router ) {

        routers[initializedModule.__metadata.name] = initializedModule;
        log.debug(`Router "${initializedModule.__metadata.name}" installed`);

      }

    }
    catch {

      continue;

    }

  }

}

function scanDirRec(dir: string): string[] {

  const all: string[] = fs.readdirSync(path.join(__dirname, dir));
  let files: string[] = [];
  const dirs: string[] = [];

  for ( const item of all ) {

    const stat = fs.statSync(path.join(__dirname, dir, item));

    if ( ! stat ) continue;

    if ( stat.isDirectory() ) dirs.push(item);
    if ( stat.isFile() ) files.push(path.join(dir, item));

  }

  for ( const item of dirs ) {

    files = _.concat(files, scanDirRec(path.join(dir, item)));

  }

  return files;

}

function injectServices(modules: any): void {

  for ( const name in modules ) {

    const module = modules[name];

    if ( module.onInjection && typeof module.onInjection === 'function' ) {

      module.onInjection(services);

      log.debug(`Services injected into ${module.__metadata.type === ModuleType.Service ? 'service' : 'router'} "${module.__metadata.name}"`);

    }

    if ( module.onConfig && typeof module.onConfig === 'function' ) {

      module.onConfig(_.cloneDeep(config));

      log.debug(`Config injected into ${module.__metadata.type === ModuleType.Service ? 'service' : 'router'} "${module.__metadata.name}"`);

    }

  }

}

function rejectForValidation(res: Response, message: string): void {

  res.status(400).json(new ServerError(message, 'VALIDATION_FAILED'));

}

function bodyValidation(bodyValidator: BodyValidator, body: any, prefix: string = ''): void|Error {

  for ( const key of _.keys(bodyValidator) ) {

    const keyPath = prefix ? prefix + '.' + key : key;

    if ( typeof bodyValidator[key] === 'function' ) {

      const validator: ValidatorFunction = <ValidatorFunction>bodyValidator[key];
      const validationResult = validator(body[key]);

      if ( validationResult === false ) return new Error(`Invalid property '${keyPath}' on body!`);
      if ( typeof validationResult !== 'boolean' && ! validationResult.valid ) return new Error(validationResult.error || `Invalid property '${keyPath}' on body!`);

    }
    else {

      if ( ! body.hasOwnProperty(key) || ! body[key] || typeof body[key] !== 'object' || body[key].constructor !== Object ) return new Error(`Invalid property '${keyPath}' on body!`);

      const error = bodyValidation(<BodyValidator>bodyValidator[key], body[key], keyPath);

      if ( error ) return error;

    }

  }

}

function createValidationMiddleware(route: RouteDefinition): RequestHandler {

  return (req: Request, res: Response, next: NextFunction) => {

    (async (): Promise<ValidationResult> => {

      for ( const rule of route.validate ) {

        if ( rule.type === ValidationType.Header ) {

          for ( const key of _.keys(<HeaderValidator>rule.validator) ) {

            const header = req.header(key);

            if ( ! header || header.toLowerCase().trim() !== rule.validator[key].toLowerCase().trim() )
              return { valid: false, error: `Invalid header '${ key }'!` };

          }

        }
        else if ( rule.type === ValidationType.Query ) {

          for ( const query of <string[]>rule.validator ) {

            if ( ! req.query[query] ) return { valid: false, error: `Missing query parameter '${query}'!` };

          }

        }
        else if ( rule.type === ValidationType.Body ) {

          if ( ! req.body || typeof req.body !== 'object' || req.body.constructor !== Object )
            return { valid: false, error: `Invalid body type!` };

          const error = bodyValidation(<BodyValidator>rule.validator, req.body);

          if ( error ) return { valid: false, error: error.message };

        }
        // Custom validation
        else if ( rule.type === ValidationType.Custom ) {

          const validationResult = await (<ValidatorFunction|AsyncValidatorFunction>rule.validator)(req);

          if ( validationResult === false ) return { valid: false, error: 'Invalid request!' };
          if ( typeof validationResult !== 'boolean' && ! validationResult.valid ) return { valid: false, error: validationResult.error || 'Invalid request!' };

        }

      }

      return { valid: true };

    })()
    .then(result => {

      if ( result.valid ) next();
      else rejectForValidation(res, result.error);

    })
    .catch(error => {

      if ( error.valid === false ) res.status(500).json(new ServerError(error.error ? error.error : 'Invalid request!', 'VALIDATION_FAILED'));
      else res.status(500).json(new ServerError('Unknown error!\n' + error, 'VALIDATION_FAILED'));

    });

  };

}

function installPredictive404(): void {

  app.use('*', (req, res, next) => {

    let matches: number = 0;

    app._router.stack.map(layer => {

      if ( layer.regexp.fast_star || layer.regexp.fast_slash ) return;

      if ( layer.match(req.originalUrl) ) matches++;

    });

    if ( matches ) next();
    else res.status(404).json(new ServerError(`Route ${req.path} not found!`, 'ROUTE_NOT_FOUND'));

  });

}

// Scan the current directory
const files = scanDirRec('..');

// Install all modules
for ( const file of files ) {

  installModule(file);

}

// Inject services
injectServices(services);
injectServices(routers);

// Install body parsers
app.use(bodyParser.text());
app.use(bodyParser.json());
app.use(bodyParser.raw({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Install body parsing error
app.use((error, req, res, next) => {

  res.status(400).json(new ServerError('Invalid body!', 'INVALID_BODY'));

});

// Sort routers based on priority
routers = _.orderBy(routers, (router: BasicModule) => router.__metadata.priority, ['desc']);

let predictive404Installed: boolean = false;

// Install routes
for ( const name in routers ) {

  const router: BasicModule = routers[name];

  // Install predictive 404 handler
  if ( config.predictive404 && config.predictive404Priority > router.__metadata.priority && ! predictive404Installed ) {

    predictive404Installed = true;

    installPredictive404();

    log.debug('Predictive 404 handler installed');

  }

  // Check router
  if ( ! router.__metadata.routes || ! router.__metadata.routes.length ) {

    log.warn(`Router "${router.__metadata.name}" has no defined routes!`);
    continue;

  }

  for ( const route of router.__metadata.routes ) {

    // Validate route definition
    if ( ! route || ! route.path || ! route.handler ) {

      log.warn(`Router "${router.__metadata.name}" has incorrectly defined a route!`);
      continue;

    }

    if ( ! Object.getOwnPropertyNames(Object.getPrototypeOf(router)).includes(route.handler) || typeof router[route.handler] !== 'function' ) {

      log.error(`Route handler "${route.handler}" not found in router "${router.__metadata.name}"!`);
      continue;

    }

    // Create route handlers
    const handlers: RequestHandler[] = [];

    // Create route logger
    handlers.push((req, res, next) => {

      log.debug(req.method.toUpperCase(), req.path);

      next();

    });
    // Create route validator if necessary
    if ( route.validate ) handlers.push(createValidationMiddleware(route));
    // Add the route handler provided by user
    handlers.push(router[route.handler].bind(router));

    // Install the route
    app[route.method || 'use'](route.path, ...handlers);

    log.debug(`Route "${(route.method ? route.method.toUpperCase() : 'GLOBAL') + ' ' + route.path}" from router "${router.__metadata.name}" was installed`);

  }

}

// Install predictive 404 (if not already)
if ( config.predictive404 && ! predictive404Installed ) {

  predictive404Installed = true;

  installPredictive404();

  log.debug('Predictive 404 handler installed');

}

// Install 404 router
if ( ! config.predictive404 ) {

  app.use('*', (req, res) => {

  res.status(404).json(new ServerError(`Route ${req.path} not found!`, 'ROUTE_NOT_FOUND'));

});

  log.debug('404 handler installed');

}

// Install error handler
app.use((error, req, res, next) => {

  log.error(error);

  if ( ! res.headerSent ) res.status(500).json(new ServerError('An internal error has occurred!'));

});

log.debug('Error handler installed');

// Misc
app.disable('x-powered-by');

// Start the server
app.listen(config.port, (error: Error) => {

  if ( error ) log.error('Could not start the server due to an error:', error);
  else log.notice(`Server started on port ${config.port}`);

});
