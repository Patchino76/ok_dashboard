"""
Variable Classifier for Cascade Optimization

Maps frontend mills parameters to optimization variable types and provides
utilities for variable classification and bounds management.
"""

from typing import Dict, List, Tuple, Any
from dataclasses import dataclass
from enum import Enum

class VariableType(Enum):
    MV = "MV"  # Manipulated Variables - what we control
    CV = "CV"  # Controlled Variables - what we measure  
    DV = "DV"  # Disturbance Variables - external factors
    TARGET = "TARGET"  # Target variables - what we optimize

@dataclass
class VariableInfo:
    """Information about a process variable"""
    id: str
    name: str
    var_type: VariableType
    unit: str
    min_bound: float
    max_bound: float
    description: str
    enabled: bool = True

class VariableClassifier:
    """
    Classifies and manages process variables based on mills parameters configuration
    """
    
    def __init__(self):
        # Variable classification based on mills-parameters.ts
        self.variable_mapping = {
            # Manipulated Variables (MVs) - what we control
            "Ore": VariableInfo("Ore", "Разход на руда", VariableType.MV, "t/h", 140, 240, "Разход на входяща руда към мелницата"),
            "WaterMill": VariableInfo("WaterMill", "Вода в мелницата", VariableType.MV, "m³/h", 5, 25, "Разход на вода в мелницата"),
            "WaterZumpf": VariableInfo("WaterZumpf", "Вода в зумпфа", VariableType.MV, "m³/h", 140, 250, "Разход на вода в зумпф"),
            "MotorAmp": VariableInfo("MotorAmp", "Ток на елетродвигателя", VariableType.MV, "A", 150, 250, "Консумация на ток от електродвигателя на мелницата"),
            
            # Controlled Variables (CVs) - what we measure
            "PulpHC": VariableInfo("PulpHC", "Пулп в ХЦ", VariableType.CV, "m³/h", 400, 600, "Разход на пулп в ХЦ"),
            "DensityHC": VariableInfo("DensityHC", "Плътност на ХЦ", VariableType.CV, "kg/m³", 1200, 2000, "Плътност на пулп в хидроциклона"),
            "PressureHC": VariableInfo("PressureHC", "Налягане на ХЦ", VariableType.CV, "bar", 0.0, 0.6, "Работно налягане в хидроциклона"),
            "PumpRPM": VariableInfo("PumpRPM", "Обороти на помпата", VariableType.CV, "rev/min", 0, 800, "Обороти на работната помпа", enabled=False),
            
            # Disturbance Variables (DVs) - external factors
            "Shisti": VariableInfo("Shisti", "Шисти", VariableType.DV, "%", 0.0, 100.0, "Процентно съдържание на шисти в рудата", enabled=False),
            "Daiki": VariableInfo("Daiki", "Дайки", VariableType.DV, "%", 0.0, 100.0, "Процентно съдържание на дайки в рудата", enabled=False),
            "Grano": VariableInfo("Grano", "Гранодиорити", VariableType.DV, "%", 0.0, 100.0, "Процентно съдържание на гранодиорити в рудата", enabled=False),
            "Class_12": VariableInfo("Class_12", "Клас 12", VariableType.DV, "%", 0.0, 100.0, "Процент материал в клас +12 милиметра", enabled=False),
            "Class_15": VariableInfo("Class_15", "Клас 15", VariableType.DV, "%", 0.0, 100.0, "Процент материал в клас +15 милиметра", enabled=False),
            "FE": VariableInfo("FE", "Желязо", VariableType.DV, "%", 0.0, 0.6, "Процент съдържание на желязо в пулпа", enabled=False),
            
            # Target Variables
            "PSI80": VariableInfo("PSI80", "Фракция -80 μk", VariableType.TARGET, "%", 40, 60.0, "Класификация на размерите на частиците при 80 микрона", enabled=False),
            "PSI200": VariableInfo("PSI200", "Фракция +200 μk", VariableType.TARGET, "%", 10, 40, "Основна целева стойност - финност на смилане +200 микрона"),
        }
    
    def get_variables_by_type(self, var_type: VariableType, enabled_only: bool = True) -> List[VariableInfo]:
        """Get all variables of a specific type"""
        variables = [var for var in self.variable_mapping.values() 
                    if var.var_type == var_type]
        if enabled_only:
            variables = [var for var in variables if var.enabled]
        return variables
    
    def get_mvs(self, enabled_only: bool = True) -> List[VariableInfo]:
        """Get Manipulated Variables (what we control)"""
        return self.get_variables_by_type(VariableType.MV, enabled_only)
    
    def get_cvs(self, enabled_only: bool = True) -> List[VariableInfo]:
        """Get Controlled Variables (what we measure)"""
        return self.get_variables_by_type(VariableType.CV, enabled_only)
    
    def get_dvs(self, enabled_only: bool = True) -> List[VariableInfo]:
        """Get Disturbance Variables (external factors)"""
        return self.get_variables_by_type(VariableType.DV, enabled_only)
    
    def get_targets(self, enabled_only: bool = True) -> List[VariableInfo]:
        """Get Target Variables (what we optimize)"""
        return self.get_variables_by_type(VariableType.TARGET, enabled_only)
    
    def get_mv_bounds(self) -> Dict[str, Tuple[float, float]]:
        """Get bounds for manipulated variables"""
        mvs = self.get_mvs()
        return {mv.id: (mv.min_bound, mv.max_bound) for mv in mvs}
    
    def get_cv_constraints(self) -> Dict[str, Tuple[float, float]]:
        """Get acceptable ranges for controlled variables (process constraints)"""
        cvs = self.get_cvs()
        return {cv.id: (cv.min_bound, cv.max_bound) for cv in cvs}
    
    def get_variable_info(self, var_id: str) -> VariableInfo:
        """Get information about a specific variable"""
        if var_id not in self.variable_mapping:
            raise ValueError(f"Variable {var_id} not found in mapping")
        return self.variable_mapping[var_id]
    
    def is_mv(self, var_id: str) -> bool:
        """Check if variable is a manipulated variable"""
        return self.get_variable_info(var_id).var_type == VariableType.MV
    
    def is_cv(self, var_id: str) -> bool:
        """Check if variable is a controlled variable"""
        return self.get_variable_info(var_id).var_type == VariableType.CV
    
    def is_dv(self, var_id: str) -> bool:
        """Check if variable is a disturbance variable"""
        return self.get_variable_info(var_id).var_type == VariableType.DV
    
    def is_target(self, var_id: str) -> bool:
        """Check if variable is a target variable"""
        return self.get_variable_info(var_id).var_type == VariableType.TARGET
    
    def get_cascade_structure(self) -> Dict[str, Any]:
        """Get the complete cascade structure for optimization"""
        return {
            'mvs': [mv.id for mv in self.get_mvs()],
            'cvs': [cv.id for cv in self.get_cvs()],
            'dvs': [dv.id for dv in self.get_dvs()],
            'targets': [target.id for target in self.get_targets()],
            'mv_bounds': self.get_mv_bounds(),
            'cv_constraints': self.get_cv_constraints(),
            'process_chain': 'MVs → CVs → Target (with DVs)',
            'description': 'Multi-model cascade: Process models (MV→CV) + Quality model (CV+DV→Target)'
        }
    
    def validate_cascade_data(self, data: Dict[str, float]) -> Tuple[bool, str]:
        """Validate that data contains required variables for cascade optimization"""
        mvs = [mv.id for mv in self.get_mvs()]
        cvs = [cv.id for cv in self.get_cvs()]
        dvs = [dv.id for dv in self.get_dvs()]
        targets = [target.id for target in self.get_targets()]
        
        required_vars = mvs + cvs + dvs + targets
        missing_vars = [var for var in required_vars if var not in data]
        
        if missing_vars:
            return False, f"Missing variables: {missing_vars}"
        
        return True, "All required variables present"
    
    def print_cascade_summary(self):
        """Print a summary of the cascade structure"""
        print("=== CASCADE OPTIMIZATION STRUCTURE ===")
        print(f"Manipulated Variables (MVs): {len(self.get_mvs())} variables")
        for mv in self.get_mvs():
            print(f"  - {mv.id}: {mv.name} ({mv.unit}) [{mv.min_bound}-{mv.max_bound}]")
        
        print(f"\nControlled Variables (CVs): {len(self.get_cvs())} variables")
        for cv in self.get_cvs():
            print(f"  - {cv.id}: {cv.name} ({cv.unit}) [{cv.min_bound}-{cv.max_bound}]")
        
        print(f"\nDisturbance Variables (DVs): {len(self.get_dvs())} variables")
        for dv in self.get_dvs():
            print(f"  - {dv.id}: {dv.name} ({dv.unit}) [{dv.min_bound}-{dv.max_bound}]")
        
        print(f"\nTarget Variables: {len(self.get_targets())} variables")
        for target in self.get_targets():
            print(f"  - {target.id}: {target.name} ({target.unit}) [{target.min_bound}-{target.max_bound}]")
        
        print(f"\nCascade Flow: MVs → CVs → Target (with DVs)")
        print("=" * 50)
