"""
S3 service for fetching ridership modeling data
"""
import json
import re
from datetime import datetime
from typing import Dict, Any, Optional, List
import aiobotocore.session
from botocore.exceptions import ClientError, NoCredentialsError
from app.core.config import settings


class S3Service:
    """Service for interacting with S3 to fetch ridership modeling data"""
    
    def __init__(self):
        self.session = aiobotocore.session.get_session()
        self.base_bucket_name = settings.S3_BUCKET_NAME
        self.file_prefix = settings.S3_FILE_PREFIX
        self.file_pattern = settings.S3_FILE_PATTERN
        # Separate cache for each environment
        self.cache = {
            'local': {'etag': None, 'data': None, 'last_modified': None},
            'production': {'etag': None, 'data': None, 'last_modified': None}
        }
    
    def get_bucket_name(self, environment: str) -> str:
        """
        Get the S3 bucket name based on the environment
        
        Args:
            environment: 'local' for staging bucket, 'production' for production bucket
            
        Returns:
            The appropriate bucket name
        """
        if environment == 'production':
            return f"{self.base_bucket_name}production"
        return f"{self.base_bucket_name}staging" 
    
    async def get_latest_file_key(self, environment: str = 'local') -> Optional[str]:
        """
        Find the most recent ridership modeling file in the S3 bucket
        
        Args:
            environment: Environment to fetch from ('local' or 'production')
        
        Returns:
            The S3 key of the most recent file, or None if no files found
        """
        bucket_name = self.get_bucket_name(environment)
        
        try:
            async with self.session.create_client('s3', region_name=settings.AWS_REGION) as s3_client:
                # List objects with the given prefix
                response = await s3_client.list_objects_v2(
                    Bucket=bucket_name,
                    Prefix=self.file_prefix
                )
                
                if 'Contents' not in response:
                    return None
                
                # Filter files that match our pattern and extract timestamps
                matching_files = []
                pattern = re.compile(rf'{re.escape(self.file_pattern)}(\d{{8}}_\d{{6}})\.json$')
                
                for obj in response['Contents']:
                    key = obj['Key']
                    match = pattern.search(key)
                    if match:
                        timestamp_str = match.group(1)
                        try:
                            # Parse timestamp format: YYYYMMDD_HHMMSS
                            timestamp = datetime.strptime(timestamp_str, '%Y%m%d_%H%M%S')
                            matching_files.append({
                                'key': key,
                                'timestamp': timestamp,
                                'last_modified': obj['LastModified']
                            })
                        except ValueError:
                            # Skip files with invalid timestamp format
                            continue
                
                if not matching_files:
                    return None
                
                # Sort by timestamp (most recent first)
                matching_files.sort(key=lambda x: x['timestamp'], reverse=True)
                return matching_files[0]['key']
                
        except (ClientError, NoCredentialsError) as e:
            print(f"Error listing S3 objects in {bucket_name}: {e}")
            return None
    
    async def get_file_metadata(self, key: str, environment: str = 'local') -> Optional[Dict[str, Any]]:
        """
        Get metadata for a specific S3 file
        
        Args:
            key: The S3 object key
            environment: Environment to fetch from ('local' or 'production')
            
        Returns:
            Dictionary with ETag and LastModified, or None if error
        """
        bucket_name = self.get_bucket_name(environment)
        
        try:
            async with self.session.create_client('s3', region_name=settings.AWS_REGION) as s3_client:
                response = await s3_client.head_object(
                    Bucket=bucket_name,
                    Key=key
                )
                return {
                    'etag': response['ETag'].strip('"'),
                    'last_modified': response['LastModified']
                }
        except (ClientError, NoCredentialsError) as e:
            print(f"Error getting S3 object metadata from {bucket_name}: {e}")
            return None
    
    async def fetch_file_content(self, key: str, environment: str = 'local') -> Optional[Dict[str, Any]]:
        """
        Fetch the content of an S3 file
        
        Args:
            key: The S3 object key
            environment: Environment to fetch from ('local' or 'production')
            
        Returns:
            Parsed JSON content or None if error
        """
        bucket_name = self.get_bucket_name(environment)
        
        try:
            async with self.session.create_client('s3', region_name=settings.AWS_REGION) as s3_client:
                response = await s3_client.get_object(
                    Bucket=bucket_name,
                    Key=key
                )
                
                # Read the file content
                content = await response['Body'].read()
                
                # Parse JSON
                data = json.loads(content.decode('utf-8'))
                
                return data
                
        except (ClientError, NoCredentialsError) as e:
            print(f"Error fetching S3 file content from {bucket_name}: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON content: {e}")
            return None
    
    async def get_latest_data(self, environment: str = 'local') -> Dict[str, Any]:
        """
        Get the latest ridership modeling data with ETag-based caching
        
        Args:
            environment: Environment to fetch from ('local' or 'production')
        
        Returns:
            Dictionary with success status and data
        """
        try:
            bucket_name = self.get_bucket_name(environment)
            
            # Find the latest file
            latest_key = await self.get_latest_file_key(environment)
            if not latest_key:
                return {
                    "success": False,
                    "error": f"No ridership modeling files found in S3 bucket: {bucket_name}"
                }
            
            # Get file metadata
            metadata = await self.get_file_metadata(latest_key, environment)
            if not metadata:
                return {
                    "success": False,
                    "error": "Could not fetch file metadata"
                }
            
            current_etag = metadata['etag']
            current_last_modified = metadata['last_modified']
            
            # Get cache for this environment
            env_cache = self.cache[environment]
            
            # Check if we have cached data and ETags match
            if (env_cache['etag'] == current_etag and 
                env_cache['data'] is not None and 
                env_cache['last_modified'] is not None):
                
                print(f"Using cached data for {latest_key} ({environment} environment)")
                return {
                    "success": True,
                    "data": {
                        "projects": env_cache['data'],
                        "lastModified": env_cache['last_modified'].isoformat(),
                        "totalCount": len(env_cache['data']) if isinstance(env_cache['data'], list) else 0,
                        "sourceFile": latest_key,
                        "fromCache": True
                    }
                }
            
            # Fetch fresh data
            print(f"Fetching fresh data from {latest_key} ({environment} environment, bucket: {bucket_name})")
            file_content = await self.fetch_file_content(latest_key, environment)
            
            if file_content is None:
                return {
                    "success": False,
                    "error": "Could not fetch file content"
                }
            
            # Update cache for this environment
            env_cache['etag'] = current_etag
            env_cache['data'] = file_content
            env_cache['last_modified'] = current_last_modified
            
            return {
                "success": True,
                "data": {
                    "projects": file_content,
                    "lastModified": current_last_modified.isoformat(),
                    "totalCount": len(file_content) if isinstance(file_content, list) else 0,
                    "sourceFile": latest_key,
                    "fromCache": False
                }
            }
            
        except Exception as e:
            print(f"Unexpected error in get_latest_data ({environment}): {e}")
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }


# Global instance
s3_service = S3Service() 