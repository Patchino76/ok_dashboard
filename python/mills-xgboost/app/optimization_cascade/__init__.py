"""
Cascade Optimization Module for Mills-AI

This module implements cascade optimization strategy using multi-model approach:
- MV → CV process models
- CV + DV → Target quality models
- Variable type classification (MV, CV, DV)
"""

from .cascade_models import CascadeModelManager
from .variable_classifier import VariableClassifier

__all__ = [
    'CascadeModelManager',
    'VariableClassifier'
]
