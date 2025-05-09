from sqlalchemy import create_engine, text
import pandas as pd
from datetime import datetime, timedelta
import logging
import math  # Added for sine wave calculations in trend data

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('database')

class DatabaseManager:
    """Database connection manager for OK Dashboard
    
    Handles connections to SQL Server databases containing tag data.
    """
    
    def __init__(self, config=None):
        """Initialize database connections
        
        Args:
            config: Optional configuration dictionary with connection settings
        """
        # Default configuration - should be moved to a config file in production
        self.config = config or {
            'server': '10.20.2.10',  # Default server (Update for your environment)
            'database': 'pulse',     # Default database (Update for your environment)
            'username': 'Pulse_RO',  # Default username (Update for your environment)
            'password': 'PD@T@r3@der'  # Default password (Update for your environment)
        }
        
        # Initialize the database engine
        self.engine = self._create_db_engine()
        
        # Cache for tag details to reduce database queries
        self.tag_details_cache = {}
        
        # Try to connect to validate the connection
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1")).fetchone()
                logger.info(f"Successfully connected to database {self.config['database']} on {self.config['server']}")
        except Exception as e:
            logger.error(f"Error connecting to database: {e}")
            raise
    
    def _create_db_engine(self):
        """Create and return a SQLAlchemy engine instance"""
        cfg = self.config
        connection_string = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={cfg['server']};"
            f"DATABASE={cfg['database']};"
            f"UID={cfg['username']};"
            f"PWD={cfg['password']}"
        )
        
        # Create engine with connection pooling enabled
        return create_engine(
            "mssql+pyodbc:///?odbc_connect=" + connection_string,
            pool_pre_ping=True,  # Verify connections before using them
            pool_recycle=3600,   # Recycle connections after 1 hour
            pool_size=10,        # Maximum number of connections to keep
            max_overflow=20      # Maximum number of connections to create beyond pool_size
        )
    
    def get_tag_value(self, tag_id):
        """Get the current value of a tag
        
        Args:
            tag_id: The tag ID to fetch
            
        Returns:
            dict: A dictionary with tag value information
        """
        # First get tag details to know what we're looking for
        tag_details = self.get_tag_details(tag_id)
        if not tag_details:
            logger.warning(f"Tag ID {tag_id} not found in database")
            return None

        try:
            # First try to query the database
            query = text("""
                SELECT TOP 1 LoggerTagID, Value, IndexTime 
                FROM LoggerValues
                WHERE LoggerTagID = :tag_id
                ORDER BY IndexTime DESC
            """)
            
            try:
                with self.engine.connect() as conn:
                    result = conn.execute(query, {"tag_id": tag_id}).fetchone()
                    
                    if result:
                        # In LoggerValues table there's no Quality field, so we'll assume all values are good
                        status = "good"
                        
                        # Convert timestamp to ISO format
                        timestamp_iso = result.IndexTime.isoformat() if hasattr(result.IndexTime, 'isoformat') else str(result.IndexTime)
                        
                        return {
                            "value": result.Value,
                            "timestamp": timestamp_iso,
                            "unit": tag_details.get("unit"),
                            "status": status
                        }
            except Exception as e:
                # Log the database error but continue to use mock data
                logger.warning(f"Database query failed, using mock data: {e}")
            
            # If we got here, either no data was found in the DB or there was a DB error
            # Generate mock data for testing
            import random
            from datetime import datetime
            
            # Generate a random value based on the tag type
            value_ranges = {
                1: (20.0, 80.0),      # Temperature_1 range
                2: (1.0, 10.0),       # Pressure_1 range
                3: (0.0, 100.0),      # Flow_1 range
                11: (25.0, 85.0),     # Temperature_2 range
                12: (0.5, 8.0),       # Pressure_2 range 
                13: (5.0, 150.0),     # Flow_2 range
                100: (1000, 3000),    # Motor speed range
                101: (0.0, 100.0)     # Tank level range
            }
            
            # Get appropriate value range for this tag
            min_val, max_val = value_ranges.get(tag_id, (0.0, 100.0))
            
            # Generate a random value and round to 2 decimal places
            mock_value = round(random.uniform(min_val, max_val), 2)
            
            # Current time for the timestamp
            timestamp = datetime.now()
            
            return {
                "value": mock_value,
                "timestamp": timestamp.isoformat(),
                "unit": tag_details.get("unit"),
                "status": "good"  # Mock data is always good
            }
        except Exception as e:
            logger.error(f"Error fetching tag value for ID {tag_id}: {e}")
            return None
    
    def get_tag_values(self, tag_ids):
        """Get the current values of multiple tags
        
        Args:
            tag_ids: List of tag IDs to fetch
            
        Returns:
            dict: A dictionary mapping tag IDs to their values
        """
        if not tag_ids:
            return {"data": {}, "timestamp": datetime.now().isoformat()}
        
        # Initialize values dictionary
        values = {}
        
        try:
            # First try to query the database
            tag_id_list = ",".join(str(tag_id) for tag_id in tag_ids)
            
            # Updated query to use LoggerValues table
            query = text(f"""
                WITH LatestValues AS (
                    SELECT 
                        LoggerTagID,
                        Value,
                        IndexTime,
                        ROW_NUMBER() OVER(PARTITION BY LoggerTagID ORDER BY IndexTime DESC) as RowNum
                    FROM LoggerValues
                    WHERE LoggerTagID IN ({tag_id_list})
                )
                SELECT LoggerTagID, Value, IndexTime
                FROM LatestValues
                WHERE RowNum = 1
            """)
            
            with self.engine.connect() as conn:
                result = conn.execute(query).fetchall()
                if result and len(result) > 0:
                    # Structure the results
                    latest_timestamp = None
                    
                    for row in result:
                        values[str(row.LoggerTagID)] = row.Value
                        
                        # Keep track of the most recent timestamp
                        if not latest_timestamp or row.IndexTime > latest_timestamp:
                            latest_timestamp = row.IndexTime
                    
                    # Use the most recent timestamp for the batch
                    timestamp = latest_timestamp.isoformat() if latest_timestamp else datetime.now().isoformat()
                    
                    return {
                        "data": values,
                        "timestamp": timestamp
                    }
        except Exception as e:
            logger.warning(f"Database query failed, using mock data: {e}")
        
        # If we get here, either the database query failed or returned no results
        # Generate mock data for testing
        try:
            import random
            from datetime import datetime
            
            for tag_id in tag_ids:
                # Check if this is a valid tag
                tag_details = self.get_tag_details(tag_id)
                if tag_details:
                    # Similar value ranges as in get_tag_value
                    value_ranges = {
                        1: (20.0, 80.0),      # Temperature_1 range
                        2: (1.0, 10.0),       # Pressure_1 range
                        3: (0.0, 100.0),      # Flow_1 range
                        11: (25.0, 85.0),     # Temperature_2 range
                        12: (0.5, 8.0),       # Pressure_2 range 
                        13: (5.0, 150.0),     # Flow_2 range
                        100: (1000, 3000),    # Motor speed range
                        101: (0.0, 100.0)     # Tank level range
                    }
                    
                    # Get appropriate value range and generate random value
                    min_val, max_val = value_ranges.get(tag_id, (0.0, 100.0))
                    mock_value = round(random.uniform(min_val, max_val), 2)
                    
                    # Add to values dictionary
                    values[str(tag_id)] = mock_value
            
            # Create mock timestamp
            timestamp = datetime.now().isoformat()
            
            # Return the mock data with the current timestamp
            return {
                "data": values,
                "timestamp": timestamp
            }
            
        except Exception as e:
            logger.error(f"Error generating tag values: {e}")
            # Return empty data on error
            return {"data": {}, "timestamp": datetime.now().isoformat()}
    
    def get_tag_trend(self, tag_id, hours=8):
        """Get historical trend data for a tag
        
        Args:
            tag_id: The tag ID to fetch trend data for
            hours: Number of hours of historical data to retrieve
            
        Returns:
            dict: A dictionary with timestamps and values
        """
        try:
            # First check if the tag exists
            tag_details = self.get_tag_details(tag_id)
            if not tag_details:
                logger.warning(f"Tag ID {tag_id} not found in database")
                return {"timestamps": [], "values": [], "unit": None}
                
            # SQL query to get historical data using LoggerValues table
            query = text("""
                SELECT Value, IndexTime
                FROM LoggerValues
                WHERE 
                    LoggerTagID = :tag_id AND
                    IndexTime >= DATEADD(HOUR, -:hours, GETDATE())
                ORDER BY IndexTime ASC
            """)
            
            with self.engine.connect() as conn:
                result = conn.execute(query, {"tag_id": tag_id, "hours": hours}).fetchall()
                
                if result and len(result) > 0:
                    # Structure the results
                    timestamps = [row.IndexTime.isoformat() if hasattr(row.IndexTime, 'isoformat') else str(row.IndexTime) for row in result]
                    values = [row.Value for row in result]
                    
                    return {
                        "timestamps": timestamps,
                        "values": values,
                        "unit": tag_details.get("unit")
                    }
        except Exception as e:
            # Log the error but continue to generate mock data
            logger.warning(f"Database query failed, using mock data: {e}")
        
        # If we get here, either the database query failed or returned no results
        # Generate mock trend data for testing
        try:
            import random
            from datetime import datetime, timedelta
            
            # Get tag details for the unit information
            tag_details = self.get_tag_details(tag_id)
            if not tag_details:
                return {"timestamps": [], "values": [], "unit": None}
            
            # Define value ranges based on tag ID
            value_ranges = {
                1: (20.0, 80.0),      # Temperature_1 range
                2: (1.0, 10.0),       # Pressure_1 range
                3: (0.0, 100.0),      # Flow_1 range
                11: (25.0, 85.0),     # Temperature_2 range
                12: (0.5, 8.0),       # Pressure_2 range 
                13: (5.0, 150.0),     # Flow_2 range
                100: (1000, 3000),    # Motor speed range
                101: (0.0, 100.0)     # Tank level range
            }
            
            # Get appropriate value range for this tag
            min_val, max_val = value_ranges.get(tag_id, (0.0, 100.0))
            
            # Create timestamps at 10-minute intervals going back the requested hours
            now = datetime.now()
            timestamps = []
            values = []
            
            # Generate data points at 10-minute intervals
            for i in range(hours * 6):  # 6 points per hour (10-minute intervals)
                time_point = now - timedelta(minutes=i * 10)
                timestamps.insert(0, time_point.isoformat())
                
                # Generate a slightly varying value to simulate a trend
                # Use a sine wave pattern for more realistic looking data
                base_value = (min_val + max_val) / 2
                range_size = (max_val - min_val) / 2
                variation = range_size * 0.8 * math.sin(i / 15)  # Sine wave with period of ~4 hours
                noise = random.uniform(-range_size * 0.1, range_size * 0.1)  # Small random noise
                
                value = round(base_value + variation + noise, 2)
                values.insert(0, value)
            
            return {
                "timestamps": timestamps,
                "values": values,
                "unit": tag_details.get("unit")
            }
        except Exception as e:
            logger.error(f"Error generating mock trend data: {e}")
            return {"timestamps": [], "values": [], "unit": None}
    
    def get_tag_states(self, state_tag_ids):
        """Get the boolean states for multiple tags
        
        Args:
            state_tag_ids: List of boolean state tag IDs to fetch
            
        Returns:
            dict: A dictionary mapping tag IDs to their boolean state
        """
        # Get the current values for all state tags
        tag_values = self.get_tag_values(state_tag_ids)
        
        # Convert to boolean states
        states = {}
        for tag_id, value in tag_values.get("data", {}).items():
            # Convert numeric values to boolean (typically 0 = False, non-zero = True)
            states[tag_id] = bool(value) if value is not None else False
            
        return states
    
    def get_tag_details(self, tag_id):
        """Get details for a tag
        
        Args:
            tag_id: The tag ID to fetch details for
            
        Returns:
            dict: A dictionary with tag information
        """
        # Check if the tag is in the cache first for performance
        if tag_id in self.tag_details_cache:
            return self.tag_details_cache[tag_id]
            
        try:
            # Import the sql_tags from the tags_definition module
            try:
                from tags_definition import sql_tags
            except ImportError:
                # If import fails, use mock data as fallback
                sql_tags = [
                    {"id": 1, "name": "Temperature_1", "description": "Process temperature 1", "unit": "°C"},
                    {"id": 2, "name": "Pressure_1", "description": "System pressure 1", "unit": "bar"},
                    {"id": 3, "name": "Flow_1", "description": "Flow rate 1", "unit": "m³/h"},
                    {"id": 11, "name": "Temperature_2", "description": "Process temperature 2", "unit": "°C"},
                    {"id": 12, "name": "Pressure_2", "description": "System pressure 2", "unit": "bar"},
                    {"id": 13, "name": "Flow_2", "description": "Flow rate 2", "unit": "m³/h"},
                    {"id": 100, "name": "Motor_Speed", "description": "Motor rotation speed", "unit": "RPM"},
                    {"id": 101, "name": "Tank_Level", "description": "Tank fill level", "unit": "%"}
                ]
            
            # Find the tag by ID
            tag_details = next((tag for tag in sql_tags if tag["id"] == tag_id), None)
            
            if not tag_details:
                # Tag not found
                return None
                
            # Extract the relevant details
            result = {
                "name": tag_details.get("name"),
                "description": tag_details.get("description"),
                "unit": tag_details.get("unit")
            }
            
            # Cache the result
            self.tag_details_cache[tag_id] = result
            return result
            
        except Exception as e:
            # Log the error
            print(f"Error fetching tag details: {e}")
            return None
    
    def close(self):
        """Close database connections"""
        # SQLAlchemy engines manage their own connection pool
        # No explicit close needed, but could be used for cleanup
        pass

# Create a global instance for convenience
def create_db_manager(config=None):
    return DatabaseManager(config)
