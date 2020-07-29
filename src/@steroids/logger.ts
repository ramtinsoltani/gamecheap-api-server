import { DateTime } from 'luxon';
import { inspect } from 'util';
import { createGzip } from 'zlib';
import os from 'os';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import fs from 'fs-extra';
import path from 'path';
import { ServerConfig } from './models';

export class ServerLogger {

  private writer: LogWriter;

  constructor(private config: ServerConfig) {

    // Reset timezone to local if it is invalid
    if ( ! DateTime.local().setZone(config.timezone).isValid ) {

      const defaultZone = DateTime.local().zone.name;

      // Show warning
      this.warn(`Invalid server timezone "${config.timezone}"! Timezone is set to "${defaultZone}"`);

      config.timezone = defaultZone;

    }

    // Instantiate the log writer
    this.writer = new LogWriter(config, error => {

      // Saving messages to file will create an infinite loop!
      console.error(this.formatLog('error', [error]));

    }, message => {

      // Saving messages to file will create an infinite loop!
      if ( this.canLog('console', 'debug') ) console.debug(this.formatLog('debug', [message]));

    });

  }

  /**
  * Returns a formatted log (colorized if specified in the config).
  * @param level Log level.
  * @param messages An array of messages.
  */
  private formatLog(level: 'debug'|'info'|'notice'|'warn'|'error', messages: any[]): string {

    const levelColors = {
      debug: 'gray',
      info: 'white',
      notice: 'blueBright',
      warn: 'yellow',
      error: 'redBright'
    };
    let logTime = `[${DateTime.local().setZone(this.config.timezone).toFormat('dd-LL-yyyy HH:mm:ss:u')}]`;
    let logLevel = level.toUpperCase();
    let logMessage = messages
    .map(message => typeof message === 'object' ? inspect(message, false, 2, this.config.colorfulLogs) : message)
    .join(' ');

    // Colorize if needed
    if ( this.config.colorfulLogs ) {

      logTime = chalk.greenBright(logTime);
      logLevel = chalk.bold[levelColors[level]](logLevel.padEnd(6));
      logMessage = chalk[levelColors[level]](logMessage);

    }

    return `${logTime} ${logLevel} ${logMessage}`;

  }

  /**
  * Determines if config allows writing logs to either the console or file.
  * @param mode Either console or file.
  * @param level Current logging level.
  */
  private canLog(mode: 'console'|'file', level: 'debug'|'info'|'notice'|'warn'|'error'): boolean {

    if ( mode === 'console' ) {

      if ( this.config.consoleLogLevels === 'all' ) return true;

      return this.config.consoleLogLevels.includes(level);

    }
    else {

      if ( this.config.logFileLevels === 'all' ) return true;

      return this.config.logFileLevels.includes(level);

    }

  }

  /**
  * Prints a message at debug level.
  */
  public debug(message: any, ...additionalMessages: any[]) {

    const log = this.formatLog('debug', [message, ...additionalMessages]);

    // Log to console
    if ( this.canLog('console', 'debug') ) console.debug(log);

    // Log to file
    if ( this.canLog('file', 'debug') ) this.writer.writeToDisk(log);

  }

  /**
  * Prints a message at info level.
  */
  public info(message: any, ...additionalMessages: any[]) {

    const log = this.formatLog('info', [message, ...additionalMessages]);

    // Log to console
    if ( this.canLog('console', 'info') ) console.log(log);

    // Log to file
    if ( this.canLog('file', 'info') ) this.writer.writeToDisk(log);

  }

  /**
  * Prints a message at notice level.
  */
  public notice(message: any, ...additionalMessages: any[]) {

    const log = this.formatLog('notice', [message, ...additionalMessages]);

    // Log to console
    if ( this.canLog('console', 'notice') ) console.log(log);

    // Log to file
    if ( this.canLog('file', 'notice') ) this.writer.writeToDisk(log);

  }

  /**
  * Prints a message at warn level.
  */
  public warn(message: any, ...additionalMessages: any[]) {

    const log = this.formatLog('warn', [message, ...additionalMessages]);

    // Log to console
    if ( this.canLog('console', 'warn') ) console.warn(log);

    // Log to file
    if ( this.canLog('file', 'warn') ) this.writer.writeToDisk(log);

  }

  /**
  * Prints a message at error level.
  */
  public error(message: any, ...additionalMessages: any[]) {

    const log = this.formatLog('error', [message, ...additionalMessages]);

    // Log to console
    if ( this.canLog('console', 'error') ) console.error(log);

    // Log to file
    if ( this.canLog('file', 'error') ) this.writer.writeToDisk(log);

  }

}

class LogWriter {

  private queue: { log: string; filename: string; }[] = [];
  private writing: boolean = false;
  private logsDir: string = path.resolve(__dirname, '..', '.logs');
  private diskManagementActive: boolean = false;
  private logFiles: { filename: string; date: DateTime; }[] = [];

  constructor(
    private config: ServerConfig,
    private onError: (error: Error) => void,
    private onMessage: (message: string) => void
  ) {

    // Ensure .logs directory
    fs.ensureDirSync(this.logsDir);

    // Activate disk management if max age is set
    if ( this.config.logFileMaxAge > 0 ) this.activateDiskManagement();

  }

  /**
  * Scans the .logs directory and updates this.logFiles with a list of valid log files.
  */
  private updateLogFiles() {

    try {

      // Scan the .logs directory to determine the old logs
      this.logFiles = fs.readdirSync(this.logsDir, { withFileTypes: true })
      .filter(file => file.isFile && file.name.match(/^\d{2}-\d{2}-\d{4}\.log$/))
      .map(file => {

        const date = DateTime.fromFormat(file.name.substr(0, 10), 'dd-LL-yyyy');

        return {
          filename: file.name,
          date: date.isValid ? date : null
        };

      })
      .filter(logFile => logFile.date !== null);

    }
    catch (error) {

      error.message = `Could not read .logs directory: ${error.message}`;
      this.onError(error);

    }

  }

  /**
  * Activates the disk management which checks the scanned log files in .logs directory
  * and archives or deletes any files that are old enough (based on config.logFileMaxAge).
  * When activated, it scans the .logs directory once only. If new files are created,
  * the directory should be rescanned again using this.updateLogFiles().
  */
  private activateDiskManagement() {

    if ( this.diskManagementActive ) return;

    this.diskManagementActive = true;

    this.updateLogFiles();

    // Check all scanned log files every second
    setInterval(() => {

      const currentDate = DateTime.local().setZone(this.config.timezone);

      for ( let i = 0; i < this.logFiles.length; i++ ) {

        const file = this.logFiles[i];
        const diff = currentDate.diff(file.date, 'days');

        // Manage logs file if the target time difference is passed
        if ( Math.floor(diff.days) >= this.config.logFileMaxAge ) {

          // Delete from this.logFiles
          this.logFiles.splice(i, 1);
          i--;

          // Archive logs file
          if ( this.config.archiveLogs ) {

            this.archiveLogs(file.filename)
            .then(() => this.onMessage(`Logs file "${file.filename}" was archived`))
            .catch(error => {

              error.message = `Could not archive logs file "${file.filename}": ${error.message}`;
              this.onError(error);

            });

          }
          // Delete logs file
          else {

            fs.remove(path.join(this.logsDir, file.filename))
            .then(() => this.onMessage(`Logs file "${file.filename}" was deleted`))
            .catch(error => {

              error.message = `Could not delete logs file "${file.filename}": ${error.message}`;
              this.onError(error);

            });

          }

        }

      }

    }, 1000);

  }

  /**
  * Archives the specified logs file by moving it to .logs/archived and compressing it.
  * @param filename The filename of the log file to archive.
  */
  private async archiveLogs(filename: string) {

    // Ensure .logs/archived
    await fs.ensureDir(path.join(this.logsDir, 'archived'));

    // Compress the logs file
    await new Promise<void>((resolve, reject) => {

      fs.createReadStream(path.join(this.logsDir, filename))
      .pipe(createGzip())
      .pipe(fs.createWriteStream(path.join(this.logsDir, 'archived', filename + '.gz')))
      .on('error', reject)
      .on('finish', resolve);

    });

    // Delete the original file
    await fs.remove(path.join(this.logsDir, filename));

  }

  /**
  * Appends the given log to the specified file (uses native EOL).
  * @param log The log (with no colors).
  * @param filename The filename.
  */
  private appendLog(log: string, filename: string) {

    return new Promise<void>((resolve, reject) => {

      // If file is new and archiving is enabled, set the scan directory flag
      const newFile: boolean = ! this.logFiles.filter(file => file.filename === filename).length && this.config.archiveLogs;

      fs.appendFile(path.join(this.logsDir, filename), log + os.EOL, { encoding: 'utf-8' }, error => {

        // Rescan the .logs directory if this file was new so archiving can detect this
        if ( newFile ) this.updateLogFiles();

        if ( error ) reject(error);
        else resolve();

      });

    });

  }

  /**
  * Writes the given log to file using an internal queue to avoid write collisions
  and guarantee correct ordering of logs.
  * Returns a promise which always resolves and should not be listened to.
  * @param log The log to write (colors will be stripped).
  */
  public async writeToDisk(log: string) {

    // If queue is busy, just add the log to it
    this.queue.push({
      log: stripAnsi(log),
      filename: DateTime.local().setZone(this.config.timezone).toFormat('dd-LL-yyyy') + '.log'
    });

    if ( this.writing ) return;

    // Otherwise, execute the queue
    this.writing = true;

    while ( this.queue.length ) {

      const item = this.queue.shift();

      try {

        await this.appendLog(item.log, item.filename);

      }
      // Could not write log to disk.
      // Avoid creating a loop by logging the error using the wrapped console.error
      // and instead pass the log to the error handler so it is logged without writing to disk
      catch (error) {

        error.message = 'Could not write log to file: ' + error.message;
        this.onError(error);

      }

    }

    this.writing = false;

  }

}
