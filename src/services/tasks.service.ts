import { Service, OnConfig } from '@steroids/core';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import EventEmitter from 'events';

@Service({
  name: 'tasks'
})
export class TasksService implements OnConfig {

  private DATA_DIR_PATH: string = path.resolve(os.homedir(), '.gamecheap');
  private DATA_FILE_PATH: string = path.resolve(this.DATA_DIR_PATH, 'tasks.json');
  private data: any;
  private tasks: Task[] = [];

  public events = new EventEmitterExtra();

  async onConfig() {

    await this.init();

  }

  /**
  * Loads the data file, starts the clock, and emits 'ready' event after.
  */
  async init() {

    // Create data directory
    await fs.ensureDir(this.DATA_DIR_PATH);

    // Load tasks.json
    if ( ! await fs.pathExists(this.DATA_FILE_PATH) ) {

      await fs.writeJson(this.DATA_FILE_PATH, {});

    }

    this.data = await fs.readJson(this.DATA_FILE_PATH);

    // Start the clock
    setInterval(async () => {

      // Check all tasks
      for ( const task of this.tasks ) {

        task.secondsPassed++;

        // Run task
        if ( (task.immediate && ! task.immediatelyRan) || task.secondsPassed === task.every ) {

          task.secondsPassed = 0;
          task.immediatelyRan = true;

          // Emit before event
          this.events.emit(`${task.name}:before`);

          let hadError = false;

          try {

            await task.task(this.data[task.name]);

          }
          catch (error) {

            hadError = true;

            // Emit error event
            this.events.emit(`${task.name}:error`, error);

          }

          // Save the data
          await fs.writeJson(this.DATA_FILE_PATH, this.data);

          // Emit after event
          if ( ! hadError ) this.events.emit(`${task.name}:after`);

        }

      }

    }, 1000);

    // Emit 'ready' event
    this.events.emitOnce('ready');

  }

  /**
  * Registers a task.
  * @param name The task name.
  * @param every The interval (in seconds) at which this task will execute every time.
  * @param immediate Whether to run the task immediately after registering it.
  * @param task The task function.
  */
  public register(name: string, every: number, immediate: boolean, task: (data: any) => void|Promise<void>) {

    this.data[name] = this.data[name] || {};

    this.tasks.push(new Task(name, every, immediate, task));

  }

}

export class Task {

  public secondsPassed: number = 0;
  public immediatelyRan: boolean = false;

  constructor(
    public name: string,
    public every: number,
    public immediate: boolean,
    public task: (data: any) => void|Promise<void>
  ) { }

}

export class EventEmitterExtra extends EventEmitter {

  private emittedOnce: { [event: string]: any[] } = {};
  private originalAddListener: Function;

  constructor() {

    super();

    this.originalAddListener = this.addListener;

  }

  public emitOnce(event: string|symbol, ...args: any[]): boolean {

    this.emittedOnce[event.toString()] = args;

    return this.emit(event, ...args);

  }

  public addListener(event: string|symbol, listener: (...args: any[]) => void): this {

    if ( this.emittedOnce[event.toString()] ) listener(...this.emittedOnce[event.toString()]);

    return this.originalAddListener(event, listener);

  }

}
