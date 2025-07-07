/**
 * API client for communicating with the FastAPI backend
 */
import axios from 'axios';
import type { ProjectsResponse } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout for S3 operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`Making API request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const projectsApi = {
  /**
   * Fetch all projects from the backend
   */
  async getProjects(environment: 'local' | 'production' = 'local'): Promise<ProjectsResponse> {
    try {
      const response = await apiClient.get<ProjectsResponse>('/api/projects', {
        params: { environment }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching projects:', error);
      
      // Return a properly formatted error response
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  },

  /**
   * Check if the API is healthy
   */
  async healthCheck(): Promise<{ message: string }> {
    const response = await apiClient.get<{ message: string }>('/');
    return response.data;
  }
};

export default apiClient; 