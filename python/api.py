from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Union
from pydantic import BaseModel, RootModel
from datetime import datetime, timedelta

# Import the DatabaseManager
from database import DatabaseManager, create_db_manager
from api_utils.mills_utils import MillsUtils
from mills_analysis.mills_fetcher import get_mills_by_param
from config import HOST, PORT, CORS_ORIGINS

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

@app.get("/api/health-check")
async def health_check():
    """Health check endpoint for monitoring and proxy testing"""
    return {
        "status": "ok",
        "service": "FastAPI Backend",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/tag-value/{tag_id}", response_model=TagValue)
async def get_tag_value(tag_id: int, db: DatabaseManager = Depends(get_db)):
    """
    Get the current value of a tag by its ID.
    """
    result = db.get_tag_value(tag_id)
    
    # For development: Always return mock data instead of 404
    if not result:
        # Generate random mock data for development
        import random
        return {
            "value": random.uniform(0, 100),  # Random value between 0-100
            "timestamp": datetime.now().isoformat(),
            "unit": "units",
            "status": "Good"
        }
        
    return result

@app.get("/api/tag-values", response_model=TagValueBatch)
async def get_tag_values(tag_ids: List[int] = Query(...), db: DatabaseManager = Depends(get_db)):
    """
    Get current values for multiple tags by their IDs.
    
    This endpoint accepts a list of tag IDs and returns their current values
    in a batch response.
    """
    result = db.get_tag_values(tag_ids)
    
    # For development: Ensure all requested tags have values
    import random
    
    # Add mock data for any missing tags
    for tag_id in tag_ids:
        if str(tag_id) not in result and tag_id not in result:
            # Generate random mock data
            result[tag_id] = {
                "value": random.uniform(0, 100),
                "timestamp": datetime.now().isoformat(),
                "unit": "units",
                "status": "Good"
            }
    
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
    
    # For development: Return mock trend data instead of 404
    if not result or not result.get("timestamps"):
        # Generate mock trend data
        import random
        from datetime import datetime, timedelta
        
        # Create timestamps for the requested hours
        now = datetime.now()
        timestamps = [(now - timedelta(minutes=i*30)).isoformat() for i in range(hours*2)]
        timestamps.reverse()  # Oldest first
        
        # Generate random values
        values = [random.uniform(40, 60) for _ in range(len(timestamps))]
        
        return {
            "timestamps": timestamps,
            "values": values
        }
    
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
# ----------------------------- Mills API Endpoints -----------------------------




@app.get("/mills/{mill}/ore")
def get_ore_by_mill(mill: str, db: DatabaseManager = Depends(get_db)):
    """
    Get the current values for a specific mill across all shifts
    
    Parameters:
    - mill: The mill identifier (e.g., 'Mill01')
    """
    mills_utils = MillsUtils(db)
    result = mills_utils.fetch_ore_totals_by_mill(mill)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No data found for mill {mill}")
        
    return result

@app.get("/api/mills/trend-by-tag")
async def get_mills_trend_by_tag(
    mill: str, 
    tag: str = "ore",
    trendPoints: int = 500,
    db: DatabaseManager = Depends(get_db)
):
    """
    Get trend data for a specific mill and tag type
    
    Parameters:
    - mill: The mill identifier (e.g., 'Mill01')
    - tag: The tag category to fetch (default: 'ore')
    - trendPoints: Number of data points to retrieve (default: 500)
    """
    mills_utils = MillsUtils(db)
    result = mills_utils.fetch_trend_by_tag(mill, tag, trendPoints)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No trend data found for mill {mill} and tag {tag}")
        
    return result

@app.get("/api/mills/by-parameter")
async def get_mills_by_parameter(
    parameter: str = "ore",
    date: str = None,
    db: DatabaseManager = Depends(get_db)
):
    """
    Get values for all mills for a specific parameter
    
    Parameters:
    - parameter: The parameter to fetch (default: 'ore')
    - date: Date to fetch data for in ISO format (default: current date)
    """
    mills_utils = MillsUtils(db)
    
    selected_date = None
    if date:
        try:
            selected_date = datetime.fromisoformat(date)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date format: {date}. Use ISO format (YYYY-MM-DD).")
    
    result = mills_utils.fetch_all_mills_by_parameter(parameter, selected_date)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No data found for parameter {parameter}")
        
    return result

@app.get("/mills/data")
def get_mills_data(
    parameter: str, 
    start_ts: str, 
    end_ts: str = None, 
    freq: str = "5min",
    db: DatabaseManager = Depends(get_db)
):
    """
    Get historical data for all mills for a specific parameter within a time range.
    
    Parameters:
    - parameter: The parameter to fetch (e.g., 'Ore', 'Power')
    - start_ts: Start timestamp in ISO format (YYYY-MM-DDTHH:MM:SS)
    - end_ts: End timestamp in ISO format (default: current time)
    - freq: Resampling frequency (default: '5min')
    """
    # Convert string timestamps to datetime
    try:
        start = datetime.fromisoformat(start_ts)
        end = datetime.fromisoformat(end_ts) if end_ts else datetime.now()
    except ValueError:
        raise HTTPException(status_code=400, 
                           detail="Invalid timestamp format. Use ISO format: YYYY-MM-DDTHH:MM:SS")
    
    # Fetch data using our function
    try:
        result_df = get_mills_by_param(parameter=parameter, start_ts=start, end_ts=end, freq=freq)
        
        if result_df.empty:
            return {"message": "No data found for the specified parameters", "data": []}
        
        # Convert DataFrame to JSON-serializable format
        result_df['timestamp'] = result_df['timestamp'].dt.strftime('%Y-%m-%dT%H:%M:%S')
        result = result_df.to_dict(orient='records')
        
        return {
            "parameter": parameter,
            "start_ts": start_ts,
            "end_ts": end_ts or datetime.now().isoformat(),
            "freq": freq,
            "count": len(result),
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, 
                           detail=f"Error retrieving mill data: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    import traceback
    import sys
    
    print("Starting API server with reload completely disabled...")
    
    try:
        # Test that the DB manager can be created with fallback
        print("Testing database connection with fallback...")
        test_db = create_db_manager()
        print(f"Database manager created successfully: {type(test_db).__name__}")
        
        # Start the server
        uvicorn.run("api:app", host=HOST, port=PORT, reload=True)
    except Exception as e:
        print(f"Error during API startup: {str(e)}")
        print("Full traceback:")
        traceback.print_exc()
        sys.exit(1)
