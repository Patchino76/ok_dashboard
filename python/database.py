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
            # Query the database for the tag value
            query = text("""
                SELECT TOP 1 LoggerTagID, Value, IndexTime 
                FROM LoggerValues
                WHERE LoggerTagID IN (:tag_id)
                ORDER BY IndexTime DESC
            """)
            
            with self.engine.connect() as conn:
                result = conn.execute(query, {"tag_id": tag_id}).fetchone()
                
                if not result:
                    logger.warning(f"No values found for tag ID {tag_id}")
                    return None
                
                # Assume all values have good quality
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
            logger.error(f"Error fetching tag value for ID {tag_id}: {e}")
            return None
    
    def get_tag_values(self, tag_ids):
        """Get current values for multiple tags at once
        
        Args:
            tag_ids: List of tag IDs to fetch
            
        Returns:
            dict: A dictionary mapping tag IDs to their value information
        """
        if not tag_ids:
            return {}

        result = {}
        
        try:
            # Get values from the database with a single query
            # Convert tag_ids to comma-separated string for SQL query
            tag_id_list = ",".join(str(tag_id) for tag_id in tag_ids)
            
            query = text(f"""
                WITH LatestTagValues AS (
                    SELECT LoggerTagID, Value, IndexTime,
                           ROW_NUMBER() OVER (PARTITION BY LoggerTagID ORDER BY IndexTime DESC) as row_num
                    FROM LoggerValues
                    WHERE LoggerTagID IN ({tag_id_list})
                )
                SELECT LoggerTagID, Value, IndexTime
                FROM LatestTagValues
                WHERE row_num = 1
            """)
            
            # Execute the query
            with self.engine.connect() as conn:
                query_results = conn.execute(query).fetchall()
                
                # Create lookup map for query results
                db_values = {}
                for row in query_results:
                    db_values[row.LoggerTagID] = {
                        "value": row.Value,
                        "timestamp": row.IndexTime.isoformat() if hasattr(row.IndexTime, 'isoformat') else str(row.IndexTime)
                    }
                    
                # Process each tag ID
                for tag_id in tag_ids:
                    # Get tag details for this tag
                    tag_details = self.get_tag_details(tag_id)
                    
                    if tag_id in db_values:
                        # We have a database value for this tag
                        result[tag_id] = {
                            "value": db_values[tag_id]["value"],
                            "timestamp": db_values[tag_id]["timestamp"],
                            "unit": tag_details.get("unit") if tag_details else "",
                            "status": "good"  # Assume good quality from database
                        }
                    else:
                        # No database value found for this tag
                        logger.warning(f"No values found for tag ID {tag_id}")
                        result[tag_id] = None
            
            return result
                
        except Exception as e:
            logger.error(f"Error fetching batch tag values: {e}")
            return {tag_id: None for tag_id in tag_ids}
    
    def get_tag_trend(self, tag_id, hours=8):
        """Get historical trend data for a tag
        
        Args:
            tag_id: The tag ID to fetch trend data for
            hours: Number of hours of history to retrieve
            
        Returns:
            dict: A dictionary with timestamps and values arrays
        """
        # Get tag details first
        tag_details = self.get_tag_details(tag_id)
        if not tag_details:
            logger.warning(f"Tag ID {tag_id} not found in database")
            return {"timestamps": [], "values": [], "unit": None}

        try:
            # Query the database for trend data
            from datetime import datetime, timedelta
            
            # Calculate the time range
            end_time = datetime.now()
            start_time = end_time - timedelta(hours=hours)
            
            # Format times for SQL query
            query = text("""
                SELECT LoggerTagID, Value, IndexTime 
                FROM LoggerValues
                WHERE LoggerTagID IN (:tag_id)
                AND IndexTime BETWEEN :start_time AND :end_time
                ORDER BY IndexTime ASC
            """)
            
            values = []
            timestamps = []
            
            with self.engine.connect() as conn:
                result = conn.execute(query, {
                    "tag_id": tag_id,
                    "start_time": start_time,
                    "end_time": end_time
                }).fetchall()
                
                if not result or len(result) == 0:
                    logger.warning(f"No trend data found for tag ID {tag_id}")
                    return {"timestamps": [], "values": [], "unit": tag_details.get("unit")}
                    
                for row in result:
                    values.append(row.Value)
                    # Convert timestamp to ISO format
                    timestamp_iso = row.IndexTime.isoformat() if hasattr(row.IndexTime, 'isoformat') else str(row.IndexTime)
                    timestamps.append(timestamp_iso)
                
                return {
                    "timestamps": timestamps,
                    "values": values,
                    "unit": tag_details.get("unit")
                }
        except Exception as e:
            logger.error(f"Error fetching trend data for tag ID {tag_id}: {e}")
            return {"timestamps": [], "values": [], "unit": None}
    
    def get_tag_states(self, state_tag_ids):
        """Get the boolean states for multiple tags
        
        Args:
            state_tag_ids: List of boolean state tag IDs to fetch
            
        Returns:
            dict: A dictionary mapping tag IDs to their boolean state
        """
        # Get the current values for all state tags from the database
        tag_values = self.get_tag_values(state_tag_ids)
        
        # Process the results to extract boolean states
        states = {}
        for tag_id in state_tag_ids:
            if tag_id in tag_values and tag_values[tag_id]:
                # For a boolean state, we're looking for values like 0/1 or True/False
                raw_value = tag_values[tag_id]["value"]
                
                # Convert various value types to a boolean
                if isinstance(raw_value, (bool, int, float)):
                    # True if value is non-zero
                    states[tag_id] = bool(raw_value)
                elif isinstance(raw_value, str):
                    # String values like 'true', 'yes', 'on', '1' are treated as True
                    states[tag_id] = raw_value.lower() in ['true', 'yes', 'on', '1']
                else:
                    # Default to False for unknown types
                    states[tag_id] = False
            else:
                # No value available, assume False
                states[tag_id] = False
        
        return states
        
    def get_tag_details(self, tag_id):
        """Get detailed information about a tag
        
        Args:
            tag_id: The tag ID to get details for
            
        Returns:
            dict: A dictionary with tag details
        """
        try:
            # First check if this is a dashboard tag
            # Import dashboard tags from the frontend
            try:
                with open('..\src\lib\tags\dashboard-tags.ts', 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # Parse the dashboard tags using a simple approach
                import re
                tag_matches = re.findall(r'{id:\s*(\d+)[^}]*name:\s*"([^"]+)"[^}]*desc:\s*"([^"]+)"[^}]*unit:\s*"([^"]+)"', content)
                
                # Create lookup dictionary from the matches
                dashboard_tags = {}
                for match in tag_matches:
                    tag_id_str, name, desc, unit = match
                    dashboard_tags[int(tag_id_str)] = {
                        "id": int(tag_id_str),
                        "name": name,
                        "description": desc,
                        "unit": unit
                    }
                
                # If tag found in the dashboard tags, return its details
                if tag_id in dashboard_tags:
                    return dashboard_tags[tag_id]
            except Exception as e:
                logger.warning(f"Error parsing dashboard tags: {e}")
            
            # Then try the sql_tags fallback list
            try:
                from tags_definition import sql_tags
                tag_details = next((tag for tag in sql_tags if tag["id"] == tag_id), None)
                if tag_details:
                    return {
                        "id": tag_details["id"],
                        "name": tag_details["name"],
                        "description": tag_details["description"],
                        "unit": tag_details["unit"]
                    }
            except Exception as e:
                logger.warning(f"Error finding tag in fallback list: {e}")
            
            # If not found in any source, create a basic tag details object
            # This ensures we don't return None for any tag ID
            basic_tag = {
                "id": tag_id,
                "name": f"Tag_{tag_id}",
                "description": f"Unknown tag {tag_id}",
                "unit": ""
            }
            return basic_tag
            
        except Exception as e:
            logger.error(f"Error getting tag details for ID {tag_id}: {e}")
            # Create a basic tag even on exception
            return {
                "id": tag_id,
                "name": f"Tag_{tag_id}",
                "description": f"Unknown tag {tag_id}",
                "unit": ""
            }
    def close(self):
        """Close database connections"""
        # SQLAlchemy engines manage their own connection pool
        # No explicit close needed, but could be used for cleanup
        pass

# Create a global instance for convenience
def create_db_manager(config=None):
    return DatabaseManager(config)
