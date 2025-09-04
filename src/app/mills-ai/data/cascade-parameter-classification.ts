/**
 * Parameter classification for cascade optimization
 * MV = Manipulated Variables (can be controlled/optimized)
 * DV = Disturbance Variables (external factors, not directly controllable)
 */

export interface CascadeParameterClassification {
  id: string
  type: 'MV' | 'DV'
  description: string
}

export const cascadeParameterClassification: CascadeParameterClassification[] = [
  // Manipulated Variables (MV) - Process parameters that can be controlled
  { id: 'Ore', type: 'MV', description: 'Ore feed rate - directly controllable' },
  { id: 'WaterMill', type: 'MV', description: 'Mill water flow - directly controllable' },
  { id: 'WaterZumpf', type: 'MV', description: 'Sump water flow - directly controllable' },
  { id: 'MotorAmp', type: 'MV', description: 'Motor current - controllable via load' },
  { id: 'PulpHC', type: 'MV', description: 'Pulp flow - controllable parameter' },
  { id: 'DensityHC', type: 'MV', description: 'Density - controllable via water/ore ratio' },
  { id: 'PressureHC', type: 'MV', description: 'Pressure - controllable parameter' },
  { id: 'PumpRPM', type: 'MV', description: 'Pump speed - directly controllable' },
  
  // Disturbance Variables (DV) - External factors not directly controllable
  { id: 'Shisti', type: 'DV', description: 'Ore hardness - geological property' },
  { id: 'Daiki', type: 'DV', description: 'Ore composition - geological property' },
  { id: 'Grano', type: 'DV', description: 'Ore granulometry - geological property' },
  { id: 'Class_12', type: 'DV', description: 'Particle size distribution - ore property' },
  { id: 'Class_15', type: 'DV', description: 'Particle size distribution - ore property' },
  { id: 'FE', type: 'DV', description: 'Iron content - ore composition' },
]

export function getParameterType(parameterId: string): 'MV' | 'DV' | 'UNKNOWN' {
  const classification = cascadeParameterClassification.find(p => p.id === parameterId)
  return classification?.type || 'UNKNOWN'
}

export function getMVParameters(): CascadeParameterClassification[] {
  return cascadeParameterClassification.filter(p => p.type === 'MV')
}

export function getDVParameters(): CascadeParameterClassification[] {
  return cascadeParameterClassification.filter(p => p.type === 'DV')
}

export function classifyParameters(parameterIds: string[]): {
  mv_parameters: string[]
  dv_parameters: string[]
  unknown_parameters: string[]
} {
  const mv_parameters: string[] = []
  const dv_parameters: string[] = []
  const unknown_parameters: string[] = []
  
  parameterIds.forEach(id => {
    const type = getParameterType(id)
    switch (type) {
      case 'MV':
        mv_parameters.push(id)
        break
      case 'DV':
        dv_parameters.push(id)
        break
      default:
        unknown_parameters.push(id)
    }
  })
  
  return { mv_parameters, dv_parameters, unknown_parameters }
}
