"""
Configuration settings for the Cascade system.
"""
import os
from pathlib import Path

# Base directory for the cascade system
BASE_DIR = Path(__file__).parent.parent

# Directory to store cascade models
MODELS_DIR = BASE_DIR / "optimization_cascade" / "cascade_models"

# Ensure models directory exists
os.makedirs(MODELS_DIR, exist_ok=True)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'dbname': os.getenv('DB_NAME', 'mills_db'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

# Default training parameters
DEFAULT_TRAIN_PARAMS = {
    'test_size': 0.2,
    'resample_freq': '5min',
    'random_state': 42
}

# Logging configuration
LOGGING_CONFIG = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
            'level': 'INFO',
        },
    },
    'loggers': {
        '': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True
        },
    }
}
