from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Union
from pydantic import BaseModel
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

class TagValueBatch(BaseModel):
    """Model for batch tag values response"""
    timestamp: str
    data: Dict[str, Union[float, bool, None]]

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
    
    if not result or not result.get("data"):
        # Return empty results rather than an error since some tags might not exist
        return {"timestamp": datetime.now().isoformat(), "data": {}}
    
    return result

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
    return db.get_tag_states(state_tag_ids)

# Startup and shutdown events

@app.on_event("startup")
async def startup_event():
    """Initialize resources on startup"""
    # The database manager is already initialized due to the global instance
    # Add any additional initialization if needed
    print("API server started - database connection initialized")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    # Close the database connections
    if db_manager:
        db_manager.close()
    print("API server shutdown - database connections closed")

# For testing/development
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
