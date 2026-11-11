import { env } from '../config/env';
import { HealthCheckData } from '../types';

export class HealthService {
  private readonly appVersion: string;

  constructor() {
    // Read version from package.json or default to 0.1.0
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkg = require('../../package.json');
      this.appVersion = pkg.version || '0.1.0';
    } catch {
      this.appVersion = '0.1.0';
    }
  }

  public getHealth(): HealthCheckData {
    return {
      status: 'ok',
      version: this.appVersion,
      environment: env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}

export const healthService = new HealthService();
