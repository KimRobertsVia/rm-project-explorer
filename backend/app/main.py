"""
FastAPI application main module
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.projects import router as projects_router
from app.core.config import settings

app = FastAPI(
    title="Project Explorer API",
    description="API for exploring project data from S3",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects_router, prefix="/api", tags=["projects"])

@app.get("/")
async def root():
    """Root endpoint for health check"""
    return {"message": "Project Explorer API is running"} 