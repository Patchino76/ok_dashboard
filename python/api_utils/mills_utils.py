import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import text
from database import DatabaseManager

class MillsUtils:
    """Utility class for mills-related data operations"""
    
    def __init__(self, db_manager: DatabaseManager):
        """Initialize with a database manager"""
        self.db_manager = db_manager
    
    def fetch_ore_totals_by_mill(self, mill: str) -> dict:
        """Get the latest values for a specific mill across all shifts
        
        Args:
            mill: The mill identifier (e.g., "Mill01")
            
        Returns:
            dict: Dictionary with shift values and mill status
        """
        from tags_definition import mills_tags, millsNames
        
        # Get all tag IDs for the specified mill from each shift
        result_dict = {}
        
        try:
            # Prepare list of tag IDs to fetch in a single query
            tag_ids = []
            tag_categories = {}
            
            # Collect tag IDs for each shift and category
            for shift_key in mills_tags.keys():
                mill_tag = next((tag for tag in mills_tags[shift_key] if tag["name"] == mill), None)
                if mill_tag:
                    tag_id = mill_tag["id"]
                    tag_ids.append(tag_id)
                    tag_categories[tag_id] = shift_key
            
            # Fetch values for all tags in a single query
            if tag_ids:
                tag_values = self.db_manager.get_tag_values(tag_ids)
                
                # Extract values for each category
                for tag_id, tag_value in tag_values.items():
                    if tag_value and tag_id in tag_categories:
                        category = tag_categories[tag_id]
                        result_dict[category] = float(tag_value["value"]) if tag_value["value"] is not None else 0.0
                    else:
                        # If we couldn't get a value, use 0
                        for category in mills_tags.keys():
                            if category not in result_dict:
                                result_dict[category] = 0.0
            
            # Set mill running state based on ore value (if ore >= 10, mill is running)
            result_dict['state'] = True if result_dict.get('ore', 0) >= 10 else False
            
            # Get the Bulgarian name for the mill
            mill_bg_title = next((item["bg"] for item in millsNames if item["en"] == mill), mill)
            result_dict["title"] = mill_bg_title
            
            return result_dict
            
        except Exception as e:
            # If there's an error, return a default structure
            return {
                "shift1": 0.0,
                "shift2": 0.0,
                "shift3": 0.0,
                "total": 0.0,
                "ore": 0.0,
                "state": False,
                "title": mill
            }
    
    def fetch_trend_by_tag(self, mill: str, tag: str, trend_points: int = 500) -> List[Dict[str, Any]]:
        """Get trend data for a specific mill and tag type
        
        Args:
            mill: The mill identifier (e.g., "Mill01")
            tag: The tag category to fetch (e.g., "ore")
            trend_points: Number of data points to retrieve
            
        Returns:
            List[Dict]: List of timestamp and value pairs
        """
        from tags_definition import mills_tags
        
        try:
            # Find the tag ID for the given mill from specified tag list
            mill_tag = next((item for item in mills_tags[tag] if item["name"] == mill), None)
            if mill_tag is None:
                return []
                
            tag_id = mill_tag["id"]
            
            # Get trend data from the database manager
            trend_result = self.db_manager.get_tag_trend(tag_id, hours=12)
            
            # Transform the data into the expected format
            result = []
            if trend_result and 'timestamps' in trend_result and 'values' in trend_result:
                for i in range(len(trend_result['timestamps'])):
                    result.append({
                        "timestamp": trend_result['timestamps'][i],
                        "value": trend_result['values'][i] or 0
                    })
            
            return result
            
        except Exception as e:
            return []
    
    def fetch_all_mills_by_parameter(self, parameter: str = "ore", selected_date: Optional[datetime.datetime] = None) -> List[Dict[str, Any]]:
        """Get values for all mills for a specific parameter
        
        Args:
            parameter: The parameter to fetch (default: "ore")
            selected_date: Date to fetch data for (default: current date)
            
        Returns:
            List[Dict]: List of mill names and values
        """
        from tags_definition import mills_tags, millsNames
        
        try:
            # Get all tags for the requested parameter
            parameter_tags = mills_tags.get(parameter, [])
            if not parameter_tags:
                return []
                
            # Get tag IDs
            tag_ids = [tag["id"] for tag in parameter_tags]
            
            # Fetch all values in a single query
            tag_values = self.db_manager.get_tag_values(tag_ids)
            
            # Combine with mill names
            result = []
            for i, tag in enumerate(parameter_tags):
                mill_en = tag["name"]
                mill_bg = next((item["bg"] for item in millsNames if item["en"] == mill_en), mill_en)
                
                value = 0.0
                tag_id = tag["id"]
                if tag_id in tag_values and tag_values[tag_id]:
                    value = float(tag_values[tag_id]["value"]) if tag_values[tag_id]["value"] is not None else 0.0
                
                result.append({
                    "mill": mill_bg,
                    "value": value
                })
                
            return result
            
        except Exception as e:
            return []
