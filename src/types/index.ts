export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  meta?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface HealthCheckData {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  environment: string;
  uptime: number;
  timestamp: string;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      startTime?: number;
    }
  }
}
