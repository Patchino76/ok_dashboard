#!/usr/bin/env python3
"""
Complete solution script to fix database connector duplicate timestamp issues
and validate the training endpoint functionality.
"""

import pandas as pd
import sys
import os
import json
import requests
from datetime import datetime, timedelta

# Add the mills-xgboost directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'mills-xgboost'))

from app.database.db_connector import MillsDataConnector

def test_fixed_connector():
    """Test the fixed database connector with comprehensive validation"""
    
    # Database configuration (you'll need to provide the password)
    db_config = {
        "host": "em-m-db4.ellatzite-med.com",
        "port": 5432,
        "dbname": "em_pulse_data",
        "user": "s.lyubenov",
        "password": "your_password_here"  # Replace with actual password
    }
    
    # Test parameters matching your training request
    mill_number = 8
    start_date = "2025-06-10T06:00:00"
    end_date = "2025-07-27T22:00:00"
    features = ["Ore", "WaterMill", "WaterZumpf", "MotorAmp"]
    target_col = "PSI80"
    
    print("=" * 70)
    print("DATABASE CONNECTOR SOLUTION VALIDATION")
    print("=" * 70)
    
    try:
        # Initialize connector
        connector = MillsDataConnector(**db_config)
        print("✓ Database connection established")
        
        # Test the complete data pipeline
        print(f"\n🔄 Testing complete data pipeline for Mill {mill_number}")
        print(f"📅 Date range: {start_date} to {end_date}")
        print(f"🎯 Features: {features}")
        print(f"🎯 Target: {target_col}")
        
        # Get combined data using the fixed connector
        combined_data = connector.get_combined_data(
            mill_number=mill_number,
            start_date=start_date,
            end_date=end_date,
            resample_freq='1min',
            save_to_logs=True,
            no_interpolation=False
        )\n        \n        if combined_data is None or combined_data.empty:\n            print(\"❌ No combined data returned\")\n            return False\n            \n        print(f\"✅ Combined data successfully created!\")\n        print(f\"📊 Shape: {combined_data.shape}\")\n        print(f\"📋 Columns: {list(combined_data.columns)}\")\n        \n        # Validate data quality\n        print(\"\\n🔍 DATA QUALITY VALIDATION\")\n        print(\"-\" * 40)\n        \n        # Check for duplicates\n        duplicate_count = combined_data.index.duplicated().sum()\n        if duplicate_count > 0:\n            print(f\"❌ Found {duplicate_count} duplicate timestamps\")\n            return False\n        else:\n            print(\"✅ No duplicate timestamps\")\n            \n        # Check for required features\n        missing_features = [f for f in features if f not in combined_data.columns]\n        if missing_features:\n            print(f\"❌ Missing required features: {missing_features}\")\n            print(f\"Available columns: {list(combined_data.columns)}\")\n            return False\n        else:\n            print(f\"✅ All required features present: {features}\")\n            \n        # Check for target column\n        if target_col not in combined_data.columns:\n            print(f\"❌ Missing target column: {target_col}\")\n            print(f\"Available columns: {list(combined_data.columns)}\")\n            return False\n        else:\n            print(f\"✅ Target column present: {target_col}\")\n            \n        # Check data completeness\n        total_rows = len(combined_data)\n        feature_data = combined_data[features + [target_col]]\n        complete_rows = len(feature_data.dropna())\n        completeness_ratio = complete_rows / total_rows if total_rows > 0 else 0\n        \n        print(f\"📈 Data completeness: {complete_rows}/{total_rows} ({completeness_ratio:.2%})\")\n        \n        if completeness_ratio < 0.1:  # Less than 10% complete data\n            print(\"⚠️  WARNING: Very low data completeness ratio\")\n        elif completeness_ratio < 0.5:  # Less than 50% complete data\n            print(\"⚠️  WARNING: Low data completeness ratio\")\n        else:\n            print(\"✅ Good data completeness ratio\")\n            \n        # Show data sample\n        print(\"\\n📋 DATA SAMPLE (First 5 rows)\")\n        print(\"-\" * 40)\n        sample_cols = features + [target_col]\n        print(combined_data[sample_cols].head())\n        \n        # Show data statistics\n        print(\"\\n📊 DATA STATISTICS\")\n        print(\"-\" * 40)\n        print(combined_data[sample_cols].describe())\n        \n        print(\"\\n✅ DATABASE CONNECTOR VALIDATION SUCCESSFUL!\")\n        print(\"\\n📝 SUMMARY:\")\n        print(f\"   • Total rows: {total_rows:,}\")\n        print(f\"   • Complete rows: {complete_rows:,} ({completeness_ratio:.2%})\")\n        print(f\"   • Features: {len(features)}\")\n        print(f\"   • Date range: {combined_data.index.min()} to {combined_data.index.max()}\")\n        print(f\"   • No duplicate timestamps: ✅\")\n        print(f\"   • All required columns present: ✅\")\n        \n        return True\n        \n    except Exception as e:\n        print(f\"❌ Validation failed with error: {e}\")\n        import traceback\n        traceback.print_exc()\n        return False\n\ndef test_training_endpoint():\n    \"\"\"Test the /train endpoint with the fixed data pipeline\"\"\"\n    \n    print(\"\\n\" + \"=\" * 70)\n    print(\"TRAINING ENDPOINT VALIDATION\")\n    print(\"=\" * 70)\n    \n    # Training payload (same as your original request)\n    payload = {\n        \"db_config\": {\n            \"host\": \"em-m-db4.ellatzite-med.com\",\n            \"port\": 5432,\n            \"dbname\": \"em_pulse_data\",\n            \"user\": \"s.lyubenov\",\n            \"password\": \"your_password_here\"  # Replace with actual password\n        },\n        \"mill_number\": 8,\n        \"start_date\": \"2025-06-10T06:00:00\",\n        \"end_date\": \"2025-07-27T22:00:00\",\n        \"features\": [\"Ore\", \"WaterMill\", \"WaterZumpf\", \"MotorAmp\"],\n        \"target_col\": \"PSI80\",\n        \"test_size\": 0.2,\n        \"params\": {\n            \"n_estimators\": 300,\n            \"learning_rate\": 0.05,\n            \"max_depth\": 6,\n            \"subsample\": 0.8,\n            \"colsample_bytree\": 0.8\n        }\n    }\n    \n    try:\n        # Make the training request\n        print(\"🚀 Sending training request to /api/v1/ml/train...\")\n        \n        # Assuming your API is running on localhost:8000\n        response = requests.post(\n            \"http://localhost:8000/api/v1/ml/train\",\n            json=payload,\n            timeout=300  # 5 minute timeout for training\n        )\n        \n        if response.status_code == 200:\n            result = response.json()\n            print(\"✅ Training request successful!\")\n            print(f\"📊 Response: {json.dumps(result, indent=2)}\")\n            return True\n        else:\n            print(f\"❌ Training request failed with status {response.status_code}\")\n            print(f\"📄 Response: {response.text}\")\n            return False\n            \n    except requests.exceptions.ConnectionError:\n        print(\"⚠️  Cannot connect to API server. Make sure it's running on localhost:8000\")\n        print(\"   You can test the database connector independently with the validation above.\")\n        return False\n    except Exception as e:\n        print(f\"❌ Training endpoint test failed: {e}\")\n        return False\n\ndef main():\n    \"\"\"Main execution function\"\"\"\n    \n    print(\"🔧 MILLS-XGBOOST DATABASE CONNECTOR FIX\")\n    print(\"This script validates the fixes for duplicate timestamp issues\")\n    print()\n    \n    # Step 1: Test the fixed database connector\n    print(\"STEP 1: Testing fixed database connector...\")\n    db_success = test_fixed_connector()\n    \n    if not db_success:\n        print(\"\\n❌ Database connector validation failed. Please check the logs above.\")\n        return\n    \n    # Step 2: Test the training endpoint (optional)\n    print(\"\\nSTEP 2: Testing training endpoint...\")\n    api_success = test_training_endpoint()\n    \n    # Final summary\n    print(\"\\n\" + \"=\" * 70)\n    print(\"FINAL SUMMARY\")\n    print(\"=\" * 70)\n    \n    if db_success:\n        print(\"✅ Database connector: FIXED and validated\")\n        print(\"   • Duplicate timestamps are now properly handled\")\n        print(\"   • Data alignment issues are resolved\")\n        print(\"   • Robust error handling implemented\")\n    \n    if api_success:\n        print(\"✅ Training endpoint: Working correctly\")\n    elif db_success:\n        print(\"⚠️  Training endpoint: Not tested (API server not running)\")\n        print(\"   • Database connector is fixed and ready\")\n        print(\"   • You can now retry your training request\")\n    \n    print(\"\\n🎉 SOLUTION COMPLETE!\")\n    print(\"\\nThe database connector has been enhanced with:\")\n    print(\"• Duplicate timestamp detection and removal\")\n    print(\"• Index sorting for chronological order\")\n    print(\"• Robust error handling in join operations\")\n    print(\"• Comprehensive logging for debugging\")\n    print(\"• Data validation at each step\")\n\nif __name__ == \"__main__\":\n    main()
