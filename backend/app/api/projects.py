"""
Projects API endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Literal
from app.services.s3_service import s3_service

router = APIRouter()


@router.get("/projects", response_model=Dict[str, Any])
async def get_projects(environment: Literal["local", "production"] = Query("local", description="Environment to fetch data from")):
    """
    Get all projects from the latest S3 ridership modeling file.
    
    Args:
        environment: The environment to fetch data from (local = staging bucket, production = production bucket)
    
    Returns:
        Dict containing success status and project data
    """
    try:
        result = await s3_service.get_latest_data(environment)
        
        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Unknown error occurred")
            )
        
        return result
        
    except HTTPException:
        # Re-raise HTTPExceptions as-is
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching projects: {str(e)}"
        ) 