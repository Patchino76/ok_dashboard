from sqlalchemy import create_engine, text
import pandas as pd

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
            'server': '10.20.2.10',  # Update with your actual server
            'database': 'pulse',     # Update with your actual database
            'username': 'Pulse_RO',  # Update with your actual username
            'password': 'PD@T@r3@der'  # Update with your actual password
        }
        
        # Initialize the database engine
        self.engine = self._create_db_engine()
    
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
        # SQL query to get the latest tag value
        # Adjust this query to match your actual database schema
        query = text("""
            SELECT TOP 1 Value, Timestamp, TagName
            FROM TagValues
            WHERE TagID = :tag_id
            ORDER BY Timestamp DESC
        """)
        
        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"tag_id": tag_id}).fetchone()
                
                if not result:
                    return None
                    
                # Get tag details to include unit information
                tag_details = self.get_tag_details(tag_id)
                    
                return {
                    "value": result.Value,
                    "timestamp": result.Timestamp.isoformat(),
                    "unit": tag_details.get("unit") if tag_details else None
                }
        except Exception as e:
            # Log the error
            print(f"Error fetching tag value: {e}")
            return None
    
    def get_tag_values(self, tag_ids):
        """Get the current values of multiple tags
        
        Args:
            tag_ids: List of tag IDs to fetch
            
        Returns:
            dict: A dictionary mapping tag IDs to their values
        """
        # SQL query to get the latest value for multiple tags
        # Adjust this query to match your actual database schema
        placeholders = ",".join([f":{i}" for i in range(len(tag_ids))])
        params = {str(i): tag_id for i, tag_id in enumerate(tag_ids)}
        
        query = text(f"""
            WITH LatestTagValues AS (
                SELECT 
                    TagID,
                    Value,
                    Timestamp,
                    ROW_NUMBER() OVER(PARTITION BY TagID ORDER BY Timestamp DESC) as RowNum
                FROM TagValues
                WHERE TagID IN ({placeholders})
            )
            SELECT TagID, Value, Timestamp
            FROM LatestTagValues
            WHERE RowNum = 1
        """)
        
        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, params).fetchall()
                
                # Structure the results
                values = {}
                timestamp = None
                
                for row in result:
                    values[str(row.TagID)] = row.Value
                    # Use the most recent timestamp as the batch timestamp
                    if not timestamp or row.Timestamp > timestamp:
                        timestamp = row.Timestamp
                
                return {
                    "data": values,
                    "timestamp": timestamp.isoformat() if timestamp else None
                }
        except Exception as e:
            # Log the error
            print(f"Error fetching tag values: {e}")
            return {"data": {}, "timestamp": None}
    
    def get_tag_trend(self, tag_id, hours=8):
        """Get historical trend data for a tag
        
        Args:
            tag_id: The tag ID to fetch trend data for
            hours: Number of hours of historical data to retrieve
            
        Returns:
            dict: A dictionary with timestamps and values
        """
        # SQL query to get historical data
        # Adjust this query to match your actual database schema
        query = text("""
            SELECT Value, Timestamp
            FROM TagValues
            WHERE 
                TagID = :tag_id AND
                Timestamp >= DATEADD(HOUR, -:hours, GETDATE())
            ORDER BY Timestamp ASC
        """)
        
        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"tag_id": tag_id, "hours": hours}).fetchall()
                
                # Structure the results
                timestamps = [row.Timestamp.isoformat() for row in result]
                values = [row.Value for row in result]
                
                # Get tag details to include unit information
                tag_details = self.get_tag_details(tag_id)
                
                return {
                    "timestamps": timestamps,
                    "values": values,
                    "unit": tag_details.get("unit") if tag_details else None
                }
        except Exception as e:
            # Log the error
            print(f"Error fetching tag trend: {e}")
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
        # SQL query to get tag details
        # Adjust this query to match your actual database schema
        query = text("""
            SELECT TagName, Description, Unit
            FROM Tags
            WHERE TagID = :tag_id
        """)
        
        try:
            with self.engine.connect() as conn:
                result = conn.execute(query, {"tag_id": tag_id}).fetchone()
                
                if not result:
                    return None
                    
                return {
                    "name": result.TagName,
                    "description": result.Description,
                    "unit": result.Unit
                }
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
