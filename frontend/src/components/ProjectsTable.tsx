/**
 * ProjectsGrid component for displaying unique projects in a beautiful card layout
 */
import React, { useState, useEffect } from 'react';
import { projectsApi } from '../services/api';
import type { UniqueProject, ProjectsData } from '../types/api';

interface ProjectsGridProps {
  className?: string;
}

type GroupByType = 'none' | 'author' | 'agency';
type SortByType = 'name' | 'agency' | 'author' | 'created_at' | 'updated_at';
type SortDirection = 'asc' | 'desc';
type Environment = 'local' | 'production';

const ProjectsGrid: React.FC<ProjectsGridProps> = ({ className = '' }) => {
  // Helper functions for URL state management
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      environment: (params.get('env') as Environment) || 'local',
      groupBy: (params.get('groupBy') as GroupByType) || 'none',
      sortBy: (params.get('sortBy') as SortByType) || 'updated_at',
      sortDirection: (params.get('sortDir') as SortDirection) || 'desc',
      selectedProjects: params.get('selected') ? new Set(params.get('selected')!.split(',')) : new Set<string>()
    };
  };

  const updateUrlParams = (updates: Partial<{
    environment: Environment;
    groupBy: GroupByType;
    sortBy: SortByType;
    sortDirection: SortDirection;
    selectedProjects: Set<string>;
  }>) => {
    const params = new URLSearchParams(window.location.search);
    
    if (updates.environment !== undefined) {
      params.set('env', updates.environment);
    }
    if (updates.groupBy !== undefined) {
      params.set('groupBy', updates.groupBy);
    }
    if (updates.sortBy !== undefined) {
      params.set('sortBy', updates.sortBy);
    }
    if (updates.sortDirection !== undefined) {
      params.set('sortDir', updates.sortDirection);
    }
    if (updates.selectedProjects !== undefined) {
      if (updates.selectedProjects.size > 0) {
        params.set('selected', Array.from(updates.selectedProjects).join(','));
      } else {
        params.delete('selected');
      }
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  // Initialize state from URL parameters
  const urlParams = getUrlParams();
  const [data, setData] = useState<ProjectsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByType>(urlParams.groupBy);
  const [sortBy, setSortBy] = useState<SortByType>(urlParams.sortBy);
  const [sortDirection, setSortDirection] = useState<SortDirection>(urlParams.sortDirection);
  const [environment, setEnvironment] = useState<Environment>(urlParams.environment);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(urlParams.selectedProjects);

  useEffect(() => {
    fetchProjects();
  }, [environment]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.config-dropdown')) {
        setShowConfig(false);
      }
    };

    if (showConfig) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConfig]);

  // Update URL when state changes
  useEffect(() => {
    updateUrlParams({ environment });
  }, [environment]);

  useEffect(() => {
    updateUrlParams({ groupBy });
  }, [groupBy]);

  useEffect(() => {
    updateUrlParams({ sortBy });
  }, [sortBy]);

  useEffect(() => {
    updateUrlParams({ sortDirection });
  }, [sortDirection]);

  useEffect(() => {
    updateUrlParams({ selectedProjects });
  }, [selectedProjects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await projectsApi.getProjects(environment);
      
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.error || 'Failed to fetch projects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getBaseUrl = () => {
    return environment === 'local' ? 'http://localhost:3000' : 'https://platform.remix.com';
  };

  const handleProjectSelect = (projectId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedProjects);
    if (isSelected) {
      newSelected.add(projectId);
    } else {
      newSelected.delete(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleSelectAll = () => {
    if (!data?.projects.unique_projects) return;
    const allProjectIds = new Set(data.projects.unique_projects.map(p => p.id));
    setSelectedProjects(allProjectIds);
  };

  const handleClearAll = () => {
    setSelectedProjects(new Set());
  };

  const getUniqueMapIds = (): string[] => {
    if (!data?.projects.jobs || selectedProjects.size === 0) return [];
    
    const mapIds = new Set<string>();
    
    // Find all jobs that belong to selected projects
    data.projects.jobs.forEach(job => {
      if (selectedProjects.has(job.request_payload.project_id) && job.map_id) {
        mapIds.add(job.map_id);
      }
    });
    
    return Array.from(mapIds).sort();
  };

  const uniqueMapIds = getUniqueMapIds();

  const sortedProjects = React.useMemo(() => {
    if (!data?.projects.unique_projects) return [];

    return [...data.projects.unique_projects].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'created_at':
        case 'updated_at':
          aValue = new Date(a[sortBy]).getTime();
          bValue = new Date(b[sortBy]).getTime();
          break;
        case 'author':
          aValue = a.author_name;
          bValue = b.author_name;
          break;
        case 'agency':
          aValue = a.agency_name;
          bValue = b.agency_name;
          break;
        default:
          aValue = a[sortBy];
          bValue = b[sortBy];
      }

      if (aValue === bValue) return 0;

      let comparison = 0;
      if (aValue < bValue) {
        comparison = -1;
      } else if (aValue > bValue) {
        comparison = 1;
      }

      return sortDirection === 'desc' ? comparison * -1 : comparison;
    });
  }, [data?.projects.unique_projects, sortBy, sortDirection]);

  const groupedProjects = React.useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', title: '', projects: sortedProjects }];
    }

    const groups: { [key: string]: UniqueProject[] } = {};
    
    sortedProjects.forEach(project => {
      const groupKey = groupBy === 'author' ? project.author_name : project.agency_name;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(project);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, projects]) => ({
        key,
        title: key,
        projects
      }));
  }, [sortedProjects, groupBy]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const ProjectCard: React.FC<{ project: UniqueProject }> = ({ project }) => {
    const isSelected = selectedProjects.has(project.id);
    const [copied, setCopied] = useState(false);

    const handleCopyId = async () => {
      try {
        await navigator.clipboard.writeText(project.id);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    };
    
    return (
      <div className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 border ${
        isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
      }`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start space-x-2 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleProjectSelect(project.id, e.target.checked)}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded flex-shrink-0"
            />
            <a 
              href={`${getBaseUrl()}/project/${project.id}`}
              className="text-sm font-semibold text-gray-900 leading-tight truncate hover:text-blue-600 transition-colors block min-w-0"
              target="_blank"
              rel="noopener noreferrer"
              title={project.name}
            >
              {project.name}
            </a>
          </div>
          <button
            onClick={handleCopyId}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2 transition-colors duration-200 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer ${
              copied ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}
            title={copied ? 'Copied!' : 'Click to copy ID'}
          >
            {copied ? (
              <>
                <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-3 w-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                {project.id}
              </>
            )}
          </button>
        </div>
        
        <div className="space-y-1 mb-3 ml-6">
          <div className="flex items-center text-xs text-gray-600">
            <svg className="h-3 w-3 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <a 
              href={`${getBaseUrl()}/admin/agencies/${project.agency_id}`}
              className="font-medium truncate hover:text-blue-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {project.agency_name}
            </a>
          </div>
          
          <div className="flex items-center text-xs text-gray-600">
            <svg className="h-3 w-3 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <a 
              href={`${getBaseUrl()}/admin/users/${project.author_id}`}
              className="truncate hover:text-blue-600 transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {project.author_name}
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100 ml-6">
          <div className="truncate pr-2">
            <span className="font-medium">Created:</span> {formatDate(project.created_at)}
          </div>
          <div className="truncate">
            <span className="font-medium">Updated:</span> {formatDate(project.updated_at)}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-lg">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading projects</h3>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={fetchProjects}
            className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.projects.unique_projects.length) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500 text-lg">No projects found</p>
      </div>
    );
  }

  return (
    <div className={`bg-white shadow-lg rounded-lg overflow-hidden max-w-6xl mx-auto ${className}`}>
      <div className="flex">
        {/* Main Content */}
        <div className="w-full">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-gray-600">
                  {data.projects.total_unique_projects} unique projects • Last updated: {new Date(data.lastModified).toLocaleString()}
                  <span className="ml-2 text-xs text-gray-500">({environment === 'local' ? 'Local' : 'Production'})</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  data.fromCache ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {data.fromCache ? 'Cached' : 'Fresh'}
                </span>
                
                {/* Three Dots Menu */}
                <div className="relative config-dropdown">
                  <button
                    onClick={() => setShowConfig(!showConfig)}
                    className="bg-gray-600 hover:bg-gray-700 text-white p-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
                    aria-label="Configuration menu"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  {showConfig && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="p-3">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Configuration</h3>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="environment-dropdown" className="block text-xs font-medium text-gray-700 mb-1">
                              Environment
                            </label>
                            <select
                              id="environment-dropdown"
                              value={environment}
                              onChange={(e) => {
                                setEnvironment(e.target.value as Environment);
                                setShowConfig(false); // Close dropdown after selection
                              }}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="local">Local Development</option>
                              <option value="production">Production</option>
                            </select>
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            <div><strong>Links:</strong> {environment === 'local' ? 'localhost:3000' : 'platform.remix.com'}</div>
                            <div><strong>Data Source:</strong> {environment === 'local' ? 'Staging bucket' : 'Production bucket'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={fetchProjects}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Selection Controls */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-gray-400">|</span>
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium cursor-pointer"
                >
                  Clear All
                </button>
                {selectedProjects.size > 0 && (
                  <span className="text-xs text-gray-600 bg-blue-100 px-2 py-1 rounded">
                    {selectedProjects.size} selected
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <label htmlFor="groupBy" className="text-xs font-medium text-gray-700">
                  Group by:
                </label>
                <select
                  id="groupBy"
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupByType)}
                  className="block w-28 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="none">None</option>
                  <option value="author">Author</option>
                  <option value="agency">Agency</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <label htmlFor="sortBy" className="text-xs font-medium text-gray-700">
                  Sort by:
                </label>
                <select
                  id="sortBy"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortByType)}
                  className="block w-28 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="name">Name</option>
                  <option value="agency">Agency</option>
                  <option value="author">Author</option>
                  <option value="created_at">Created</option>
                  <option value="updated_at">Updated</option>
                </select>
              </div>

              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="flex items-center space-x-1 px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                <span>{sortDirection === 'asc' ? 'Asc' : 'Desc'}</span>
              </button>
            </div>
          </div>

          {/* Project Grid */}
          <div className="p-4">
            {groupedProjects.map(group => (
              <div key={group.key} className="mb-6 last:mb-0">
                {group.title && (
                  <h3 className="text-base font-semibold text-gray-900 mb-3 pb-1 border-b border-gray-200">
                    {group.title} ({group.projects.length})
                  </h3>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.projects.map(project => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Source: {data.sourceFile} • Exported: {new Date(data.projects.exported_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Side Panel */}
        {selectedProjects.size > 0 && (
          <div className="w-80 bg-gray-50 border-l border-gray-200 fixed top-0 right-0 h-screen overflow-y-auto z-40">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Map Analysis</h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedProjects.size} projects selected
              </p>
            </div>
            <div className="p-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">
                  Unique Map IDs ({uniqueMapIds.length})
                </h4>
                {uniqueMapIds.length > 0 ? (
                  <div className="space-y-2">
                    {uniqueMapIds.map(mapId => (
                      <div
                        key={mapId}
                        className="px-3 py-2 bg-gray-50 rounded text-xs font-mono text-gray-800 break-all"
                      >
                        {mapId}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    No map IDs found for selected projects
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsGrid; 