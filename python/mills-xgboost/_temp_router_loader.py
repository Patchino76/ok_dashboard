
import sys
import os
import json
from pathlib import Path
from fastapi import APIRouter

# Add current dir to path
sys.path.insert(0, os.path.dirname(__file__))

# Import the router
try:
    from app.api.endpoints import router
    routes = []
    for route in router.routes:
        routes.append({
            'path': route.path,
            'name': route.name,
            'methods': [m for m in route.methods]
        })
    print(json.dumps({'success': True, 'routes': routes}))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
