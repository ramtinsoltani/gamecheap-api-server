import { ServerConfig } from '../config.model';
export { ServerConfig } from '../config.model';

export interface BaseServerConfig {

  port: number;
  predictive404: boolean;
  predictive404Priority: number;
  timezone: string;
  colorfulLogs: boolean;
  consoleLogLevels: ('debug'|'info'|'notice'|'warn'|'error')[]|'all';
  writeLogsToFile: boolean;
  logFileLevels: ('debug'|'info'|'notice'|'warn'|'error')[]|'all';
  logFileMaxAge: number;
  archiveLogs: boolean;

}

export interface ModuleDecoratorArgs {

  name: string;

}

export interface RouterDecoratorArgs extends ModuleDecoratorArgs {

  routes: RouteDefinition[];
  priority?: number;

}

export interface RouteDefinition {

  path: string;
  handler: string;
  method?: RouteMethod;
  validate?: ValidationRule[];

}

export enum RouteMethod {

  GET = 'get',
  POST = 'post',
  PUT = 'put',
  DELETE = 'delete',
  PATCH = 'patch'

}

export enum ModuleType {

  Service,
  Router

}

export interface BasicModule {

  __metadata: ModuleMetadata;

}

export interface ModuleMetadata {

  name: string;
  type: ModuleType;
  routes?: RouteDefinition[];
  priority?: number;

}

export interface OnInjection {

  onInjection: (services: any) => void;

}

export interface OnConfig {

  onConfig: (config: ServerConfig) => void;

}

export enum ValidationType {

  Header,
  Query,
  Body,
  Custom

}

export interface ValidationRule {

  type: ValidationType;
  validator: HeaderValidator|BodyValidator|ValidatorFunction|AsyncValidatorFunction|string[];

}

export interface HeaderValidator {

  [key: string]: string;

}

export interface BodyValidator {

  [key: string]: ValidatorFunction|BodyValidator;

}

export interface FlatBodyValidator {

  [key: string]: ValidatorFunction

}

export type ValidatorFunction = (value: any) => boolean|ValidationResult;
export type AsyncValidatorFunction = (value: any) => Promise<boolean|ValidationResult>;

export interface ValidationResult {

  valid: boolean;
  error?: string;

}
