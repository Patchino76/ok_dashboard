/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please import from '@/app/mills-ai/data/mills-parameters' instead.
 */

// Re-export types and parameters from the consolidated location
export type { ModelParameter } from '../types/parameters';

// Re-export everything from mills-parameters
export { 
  millsParameters as default,
  parameterIcons,
  parameterColors,
  getParameterDefaultValues,
  getParameterBounds,
  getFeatures,
  getTargets,
  mapToStoreParameters,
  useDefaultParameters
} from '../data/mills-parameters';
