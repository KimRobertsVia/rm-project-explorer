/**
 * TypeScript interfaces for API responses and data structures
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RidershipJob {
  id: string;
  type: string;
  status: string;
  user_id: number;
  map_id: string | null;
  request_payload: {
    map_type: string;
    project_id: string;
    baseline_project_id: string;
    map_id?: string;
    service_period_id?: string;
  };
  result: {
    bytes?: number;
    run_id?: string;
    status?: string;
    triggered?: boolean;
    results_od: string;
    results_stops: string;
    results_routes: string;
  };
  created_at: string;
  updated_at: string;
}

export interface UniqueProject {
  id: string;
  name: string;
  agency_id: string;
  agency_name: string;
  author_id: number;
  author_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectsData {
  projects: {
    exported_at: string;
    total_jobs: number;
    total_unique_projects: number;
    jobs: RidershipJob[];
    unique_projects: UniqueProject[];
  };
  lastModified: string;
  totalCount: number;
  sourceFile: string;
  fromCache: boolean;
}

export type ProjectsResponse = ApiResponse<ProjectsData>; 