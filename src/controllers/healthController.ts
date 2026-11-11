import { Request, Response } from 'express';
import { healthService } from '../services/healthService';
import { ApiResponse, HealthCheckData } from '../types';

export class HealthController {
  public getHealth(_req: Request, res: Response): void {
    const healthData = healthService.getHealth();
    const response: ApiResponse<HealthCheckData> = {
      success: true,
      data: healthData,
    };
    res.status(200).json(response);
  }
}

export const healthController = new HealthController();
