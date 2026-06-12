#!/usr/bin/env python3
"""
Diagnostic script to analyze cascade model metadata.json files
and identify problematic float values causing JSON serialization errors.
"""

import json
import os
import numpy as np
import math
from pathlib import Path

def check_float_value(value, path=""):
    """Check if a float value is JSON compliant."""
    if isinstance(value, (int, str, bool)) or value is None:
        return True, None
    
    if isinstance(value, float):
        if math.isnan(value):
            return False, f"NaN at {path}"
        if math.isinf(value):
            return False, f"Infinity at {path}"
        if not (-1.7976931348623157e+308 <= value <= 1.7976931348623157e+308):
            return False, f"Out of range float at {path}: {value}"
    
    if isinstance(value, np.floating):
        if np.isnan(value):
            return False, f"numpy NaN at {path}"
        if np.isinf(value):
            return False, f"numpy Infinity at {path}"
    
    return True, None

def analyze_json_data(data, path="root"):
    """Recursively analyze JSON data for problematic float values."""
    issues = []
    
    if isinstance(data, dict):
        for key, value in data.items():
            current_path = f"{path}.{key}"
            is_valid, issue = check_float_value(value, current_path)
            if not is_valid:
                issues.append(issue)
            elif isinstance(value, (dict, list)):
                issues.extend(analyze_json_data(value, current_path))
    
    elif isinstance(data, list):
        for i, value in enumerate(data):
            current_path = f"{path}[{i}]"
            is_valid, issue = check_float_value(value, current_path)
            if not is_valid:
                issues.append(issue)
            elif isinstance(value, (dict, list)):
                issues.extend(analyze_json_data(value, current_path))
    
    else:
        is_valid, issue = check_float_value(data, path)
        if not is_valid:
            issues.append(issue)
    
    return issues

def analyze_cascade_metadata():
    """Analyze all cascade model metadata files."""
    cascade_models_dir = Path("mills-xgboost/app/optimization_cascade/cascade_models")
    
    if not cascade_models_dir.exists():
        print(f"Directory not found: {cascade_models_dir}")
        return
    
    print("Analyzing cascade model metadata files...")
    print("=" * 60)
    
    total_issues = 0
    
    for mill_dir in cascade_models_dir.iterdir():
        if mill_dir.is_dir() and mill_dir.name.startswith('mill_'):
            metadata_file = mill_dir / "metadata.json"
            
            print(f"\n📁 Analyzing {mill_dir.name}")
            print("-" * 40)
            
            if not metadata_file.exists():
                print(f"❌ metadata.json not found in {mill_dir}")
                continue
            
            try:
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                
                print(f"✅ Successfully loaded metadata.json")
                print(f"📊 Keys in metadata: {list(metadata.keys())}")
                
                # Analyze for problematic float values
                issues = analyze_json_data(metadata, f"{mill_dir.name}")
                
                if issues:
                    print(f"🚨 Found {len(issues)} JSON compliance issues:")
                    for issue in issues:
                        print(f"   - {issue}")
                    total_issues += len(issues)
                else:
                    print("✅ No JSON compliance issues found")
                
                # Try to serialize to JSON to test
                try:
                    json.dumps(metadata)
                    print("✅ JSON serialization test passed")
                except (ValueError, TypeError) as e:
                    print(f"❌ JSON serialization test failed: {e}")
                    total_issues += 1
                
            except Exception as e:
                print(f"❌ Error loading metadata.json: {e}")
                total_issues += 1
    
    print("\n" + "=" * 60)
    print(f"📋 SUMMARY: Found {total_issues} total issues")
    
    if total_issues > 0:
        print("\n🔧 RECOMMENDED ACTIONS:")
        print("1. Fix NaN/Infinity values in metadata.json files")
        print("2. Ensure all float values are within JSON-compliant range")
        print("3. Consider using the sanitize_json_data function from memory")

if __name__ == "__main__":
    analyze_cascade_metadata()
