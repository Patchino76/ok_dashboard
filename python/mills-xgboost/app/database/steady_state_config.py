"""
Steady-State Detection Configuration

Defines stability criteria for different variable types based on process knowledge.
These thresholds determine what constitutes "steady-state" operation.
"""

from dataclasses import dataclass
from typing import Dict, Optional
import pandas as pd


@dataclass
class VariableStabilityCriteria:
    """Stability criteria for a single variable"""
    name: str
    rolling_std_threshold_pct: Optional[float] = None  # % of mean
    rolling_std_threshold_abs: Optional[float] = None  # Absolute value
    max_step_change_pct: Optional[float] = None  # Maximum % change in window
    max_rate_of_change: Optional[float] = None  # Maximum rate per minute
    
    def __repr__(self):
        return f"Criteria({self.name}: std<{self.rolling_std_threshold_pct or self.rolling_std_threshold_abs})"


class SteadyStateConfig:
    """
    Configuration for steady-state detection based on process requirements.
    
    Based on the guidance:
    - MVs: Tight control on manipulated variables
    - CVs: Process stability indicators
    - Target: Quality measurement stability
    """
    
    def __init__(
        self,
        window_minutes: int = 60,
        buffer_minutes: int = 30,
        min_samples_per_window: int = 30,
        enable_quality_filters: bool = True
    ):
        """
        Initialize steady-state configuration.
        
        Args:
            window_minutes: Window size for stability check (default: 60 min)
            buffer_minutes: Buffer before window to ensure sustained stability (default: 30 min)
            min_samples_per_window: Minimum data points required in window
            enable_quality_filters: Enable sensor/maintenance quality filters
        """
        self.window_minutes = window_minutes
        self.buffer_minutes = buffer_minutes
        self.total_window_minutes = window_minutes + buffer_minutes  # 90 min total
        self.min_samples_per_window = min_samples_per_window
        self.enable_quality_filters = enable_quality_filters
        
        # Define stability criteria per variable type
        self._init_stability_criteria()
    
    def _init_stability_criteria(self):
        """Initialize stability criteria for each variable based on process knowledge"""
        
        # Manipulated Variables (MVs) - What we control
        # Require tight stability as these are operator/controller setpoints
        self.mv_criteria = {
            'Ore': VariableStabilityCriteria(
                name='Ore',
                rolling_std_threshold_pct=2.0,  # Rolling std < 2% of mean
                max_step_change_pct=5.0,  # No step changes > 5% in window
                max_rate_of_change=0.5  # < 0.5 t/h per minute
            ),
            'WaterMill': VariableStabilityCriteria(
                name='WaterMill',
                rolling_std_threshold_pct=3.0,  # Rolling std < 3% of mean
                max_step_change_pct=10.0
            ),
            'WaterZumpf': VariableStabilityCriteria(
                name='WaterZumpf',
                rolling_std_threshold_pct=3.0,  # Rolling std < 3% of mean
                max_step_change_pct=10.0
            ),
            'MotorAmp': VariableStabilityCriteria(
                name='MotorAmp',
                rolling_std_threshold_pct=5.0,  # Rolling std < 5% of mean
                max_step_change_pct=10.0  # Indicates stable mill load
            )
        }
        
        # Controlled Variables (CVs) - What we measure
        # Stability indicates process is in equilibrium
        self.cv_criteria = {
            'DensityHC': VariableStabilityCriteria(
                name='DensityHC',
                rolling_std_threshold_abs=20.0,  # < 20 kg/m³ (≈0.02 g/cm³)
                max_step_change_pct=5.0  # Critical: density fluctuations indicate flow instability
            ),
            'PressureHC': VariableStabilityCriteria(
                name='PressureHC',
                rolling_std_threshold_pct=5.0,  # Rolling std < 5% of mean
                max_step_change_pct=10.0  # Stable pressure = stable hydraulics
            ),
            'PulpHC': VariableStabilityCriteria(
                name='PulpHC',
                rolling_std_threshold_pct=3.0,  # Rolling std < 3% of mean
                max_step_change_pct=8.0
            )
        }
        
        # Disturbance Variables (DVs) - External factors
        # These change slowly (ore characteristics), less strict
        self.dv_criteria = {
            'Shisti': VariableStabilityCriteria(
                name='Shisti',
                rolling_std_threshold_pct=10.0  # Ore composition changes slowly
            ),
            'Daiki': VariableStabilityCriteria(
                name='Daiki',
                rolling_std_threshold_pct=10.0
            ),
            'Grano': VariableStabilityCriteria(
                name='Grano',
                rolling_std_threshold_pct=10.0
            ),
            'Class_12': VariableStabilityCriteria(
                name='Class_12',
                rolling_std_threshold_pct=8.0
            ),
            'Class_15': VariableStabilityCriteria(
                name='Class_15',
                rolling_std_threshold_pct=8.0
            ),
            'FE': VariableStabilityCriteria(
                name='FE',
                rolling_std_threshold_pct=10.0
            )
        }
        
        # Target Variables - Quality measurements
        # Need measurement repeatability
        self.target_criteria = {
            'PSI200': VariableStabilityCriteria(
                name='PSI200',
                rolling_std_threshold_pct=8.0,  # Allow some measurement variation
                max_step_change_pct=15.0
            ),
            'PSI80': VariableStabilityCriteria(
                name='PSI80',
                rolling_std_threshold_pct=8.0,
                max_step_change_pct=15.0
            )
        }
        
        # Combine all criteria
        self.all_criteria = {
            **self.mv_criteria,
            **self.cv_criteria,
            **self.dv_criteria,
            **self.target_criteria
        }
    
    def get_criteria(self, variable_name: str) -> Optional[VariableStabilityCriteria]:
        """Get stability criteria for a specific variable"""
        return self.all_criteria.get(variable_name)
    
    def get_required_variables(self) -> Dict[str, list]:
        """Get lists of required variables by type"""
        return {
            'mvs': list(self.mv_criteria.keys()),
            'cvs': list(self.cv_criteria.keys()),
            'dvs': list(self.dv_criteria.keys()),
            'targets': list(self.target_criteria.keys())
        }
    
    def get_window_size(self, as_timedelta: bool = False):
        """Get window size for rolling calculations"""
        if as_timedelta:
            return pd.Timedelta(minutes=self.window_minutes)
        return self.window_minutes
    
    def get_total_window_size(self, as_timedelta: bool = False):
        """Get total window size including buffer"""
        if as_timedelta:
            return pd.Timedelta(minutes=self.total_window_minutes)
        return self.total_window_minutes
    
    def __repr__(self):
        return (f"SteadyStateConfig(window={self.window_minutes}min, "
                f"buffer={self.buffer_minutes}min, "
                f"total={self.total_window_minutes}min)")


# Default configuration instance
DEFAULT_CONFIG = SteadyStateConfig(
    window_minutes=60,
    buffer_minutes=30,
    min_samples_per_window=30,
    enable_quality_filters=True
)
