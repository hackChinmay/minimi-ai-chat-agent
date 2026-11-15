import { ApiResponse, ApiErrorPayload } from '../types/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  public readonly code: string;
  public readonly details?: unknown;
  public readonly status: number;

  constructor(status: number, payload?: ApiErrorPayload) {
    super(payload?.message || `HTTP request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.code || 'UNKNOWN_ERROR';
    this.details = payload?.details;
  }
}

export async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options?.headers,
    },
  });

  let json: ApiResponse<T> | undefined;
  try {
    json = await response.json();
  } catch {
    // If response body is not JSON
  }

  if (!response.ok || !json?.success) {
    throw new ApiError(response.status, json?.error);
  }

  return json.data as T;
}
