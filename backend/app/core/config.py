"""
Configuration settings for the FastAPI application
"""
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server settings
    PORT: int = 8000
    
    # AWS Settings (credentials will be provided via aws-vault)
    AWS_REGION: str = "eu-west-1"
    S3_BUCKET_NAME: str = "citymapper-cfc-ridership-modeling-eu-west-1-"
    S3_FILE_PREFIX: str = "ridership_modeling_dumps/"
    S3_FILE_PATTERN: str = "ridership_modeling_jobs_"
    
    # CORS settings
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings() 