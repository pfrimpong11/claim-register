export class HealthService {
  /**
   * @param {object} dependencies
   * @param {{ query: (text: string) => Promise<unknown> }} dependencies.database
   * @param {{ ping: () => Promise<unknown> }} dependencies.redis
   * @param {() => boolean} dependencies.isWorkerReady
   * @param {boolean} dependencies.workerRequired
   */
  constructor({ database, redis, isWorkerReady, workerRequired }) {
    this.database = database;
    this.redis = redis;
    this.isWorkerReady = isWorkerReady;
    this.workerRequired = workerRequired;
  }

  live() {
    return { status: 'ok' };
  }

  async ready() {
    const checks = await Promise.allSettled([this.database.query('SELECT 1'), this.redis.ping()]);
    const database = checks[0].status === 'fulfilled';
    const redis = checks[1].status === 'fulfilled';
    const worker = !this.workerRequired || this.isWorkerReady();

    return { ready: database && redis && worker, checks: { database, redis, worker } };
  }
}
