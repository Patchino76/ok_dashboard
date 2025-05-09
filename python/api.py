from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Union
from pydantic import BaseModel, RootModel
from datetime import datetime, timedelta

# Import the DatabaseManager
from database import DatabaseManager, create_db_manager

# Configuration
CORS_ORIGINS = ["http://localhost:3000"]  # Add production URLs as needed

app = FastAPI(title="OK Dashboard API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------- Models -----------------------------

class TagValue(BaseModel):
    """Model for tag value response"""
    value: Union[float, bool, None]
    timestamp: str
    unit: Optional[str] = None
    status: Optional[str] = None

class TagValueBatch(RootModel):
    """Model for batch tag values response"""
    root: Dict[str, Optional[TagValue]]

class TagTrend(BaseModel):
    """Model for tag trend data"""
    timestamps: List[str]
    values: List[Union[float, bool, None]]
    unit: Optional[str] = None

# ----------------------------- Dependencies -----------------------------

# Create a shared database manager instance
db_manager = create_db_manager()

def get_db():
    """Dependency to get database connection"""
    try:
        yield db_manager
    finally:
        # No need to explicitly close connections since the db_manager is reused
        pass

# ----------------------------- API Endpoints -----------------------------

@app.get("/api/tag-value/{tag_id}", response_model=TagValue)
async def get_tag_value(tag_id: int, db: DatabaseManager = Depends(get_db)):
    """
    Get the current value of a tag by its ID.
    """
    result = db.get_tag_value(tag_id)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"Tag with ID {tag_id} not found")
        
    return result

@app.get("/api/tag-values", response_model=TagValueBatch)
async def get_tag_values(tag_ids: List[int] = Query(...), db: DatabaseManager = Depends(get_db)):
    """
    Get current values for multiple tags by their IDs.
    
    This endpoint accepts a list of tag IDs and returns their current values
    in a batch response.
    """
    result = db.get_tag_values(tag_ids)
    
    # Convert tag_ids to strings to ensure JSON compatibility
    string_keyed_result = {str(tag_id): value for tag_id, value in result.items()}
    
    return TagValueBatch(root=string_keyed_result)

@app.get("/api/tag-trend/{tag_id}", response_model=TagTrend)
async def get_tag_trend(
    tag_id: int, 
    hours: int = 8,
    db: DatabaseManager = Depends(get_db)
):
    """
    Get historical trend data for a tag by its ID.
    
    Parameters:
    - tag_id: The ID of the tag to fetch trend data for
    - hours: Number of hours of historical data to retrieve (default: 8)
    """
    result = db.get_tag_trend(tag_id, hours)
    
    if not result or not result.get("timestamps"):
        raise HTTPException(status_code=404, detail=f"No trend data found for tag ID {tag_id}")
    
    return result

@app.get("/api/tag-states", response_model=Dict[str, bool])
async def get_tag_states(
    state_tag_ids: List[int] = Query(...),
    db: DatabaseManager = Depends(get_db)
):
    """
    Get the boolean states for multiple tags.
    
    This endpoint is specifically for fetching boolean state tags that
    control the active/inactive state of analog tags.
    """
    result = db.get_tag_states(state_tag_ids)
    
    # Convert numeric tag_ids to strings for JSON compatibility
    string_keyed_result = {str(tag_id): state for tag_id, state in result.items()}
    
    return string_keyed_result

# For testing/development
if __name__ == "__main__":
    import uvicorn
    print("Starting API server with reload completely disabled...")
    # Completely disable reload to avoid spurious file change detection
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=False)
