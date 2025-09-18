"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Target } from "lucide-react"
import { classifyParameters } from "../../data/cascade-parameter-classification"

interface CascadeFlowDiagramProps {
  modelFeatures?: string[]
  modelTarget?: string
  featureClassification?: {
    mv_features: string[]
    cv_features: string[]
    dv_features: string[]
    target_features: string[]
  }
  className?: string
}

export function CascadeFlowDiagram({ 
  modelFeatures = [], 
  modelTarget = "PSI80",
  featureClassification,
  className = ""
}: CascadeFlowDiagramProps) {
  // Use feature classification from cascade model API if available, otherwise fallback to static classification
  let mv_parameters: string[], cv_parameters: string[], dv_parameters: string[];
  
  if (featureClassification) {
    // Use the actual feature classification from the cascade model
    mv_parameters = featureClassification.mv_features || [];
    cv_parameters = featureClassification.cv_features || [];
    dv_parameters = featureClassification.dv_features || [];
    
    console.log('🏷️ Using cascade model feature classification:', {
      mv_parameters,
      cv_parameters,
      dv_parameters
    });
  } else {
    // Fallback to static classification
    const { mv_parameters: mv, dv_parameters: dv, unknown_parameters } = classifyParameters(modelFeatures);
    mv_parameters = mv;
    dv_parameters = dv;
    cv_parameters = unknown_parameters;
    
    console.log('⚠️ Using fallback static classification:', {
      mv_parameters,
      cv_parameters,
      dv_parameters
    });
  }

  // Variable type styling
  const getVarTypeStyle = (varType: "MV" | "CV" | "DV") => {
    switch (varType) {
      case "MV":
        return {
          bg: "bg-gradient-to-br from-amber-50 to-orange-50",
          border: "border-amber-200",
          text: "text-amber-800",
          badge: "bg-amber-100 text-amber-800 border-amber-200"
        };
      case "CV":
        return {
          bg: "bg-gradient-to-br from-blue-50 to-cyan-50",
          border: "border-blue-200",
          text: "text-blue-800",
          badge: "bg-blue-100 text-blue-800 border-blue-200"
        };
      case "DV":
        return {
          bg: "bg-gradient-to-br from-emerald-50 to-green-50",
          border: "border-emerald-200",
          text: "text-emerald-800",
          badge: "bg-emerald-100 text-emerald-800 border-emerald-200"
        };
    }
  };

  const ParameterGroup = ({ 
    title, 
    varType, 
    parameters, 
    description 
  }: { 
    title: string; 
    varType: "MV" | "CV" | "DV"; 
    parameters: string[]; 
    description: string;
  }) => {
    const style = getVarTypeStyle(varType);
    
    return (
      <div className={`p-4 rounded-lg border-2 ${style.bg} ${style.border} min-h-[120px] flex flex-col`}>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className={`text-xs px-2 py-1 ${style.badge}`}>
            {varType}
          </Badge>
          <h3 className={`font-semibold ${style.text}`}>{title}</h3>
        </div>
        <p className="text-xs text-slate-600 mb-3">{description}</p>
        <div className="flex-1 flex flex-wrap gap-1">
          {parameters.length > 0 ? (
            parameters.map((param) => (
              <span
                key={param}
                className={`text-xs px-2 py-1 rounded ${style.badge} font-medium`}
              >
                {param}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">None configured</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className={`shadow-lg border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-600" />
          Cascade Flow Diagram
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Flow Diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
            {/* MV Parameters */}
            <ParameterGroup
              title="Manipulated Variables"
              varType="MV"
              parameters={mv_parameters}
              description="Variables we can control and optimize"
            />

            {/* Arrow 1 */}
            <div className="flex justify-center">
              <ArrowRight className="h-8 w-8 text-slate-400" />
            </div>

            {/* CV Parameters */}
            <ParameterGroup
              title="Controlled Variables"
              varType="CV"
              parameters={cv_parameters}
              description="Variables we measure and predict"
            />

            {/* Arrow 2 */}
            <div className="flex justify-center">
              <ArrowRight className="h-8 w-8 text-slate-400" />
            </div>
          </div>

          {/* Target and DV Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Target */}
            <div className="p-4 rounded-lg border-2 bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs px-2 py-1 bg-purple-100 text-purple-800 border-purple-200">
                  TARGET
                </Badge>
                <h3 className="font-semibold text-purple-800">Optimization Target</h3>
              </div>
              <p className="text-xs text-slate-600 mb-3">Final objective we want to optimize</p>
              <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 border border-purple-200 font-medium">
                {modelTarget}
              </span>
            </div>

            {/* DV Parameters */}
            <ParameterGroup
              title="Disturbance Variables"
              varType="DV"
              parameters={dv_parameters}
              description="External factors and lab parameters"
            />
          </div>

          {/* Flow Description */}
          <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg">
            <div className="font-medium mb-1">Cascade Process Flow:</div>
            <div className="text-xs">
              1. Adjust <span className="font-medium text-amber-700">MV parameters</span> (what we control) →
              2. Predict <span className="font-medium text-blue-700">CV parameters</span> (what we measure) →
              3. Optimize <span className="font-medium text-purple-700">Target variable</span> (our objective)
              <br />
              <span className="font-medium text-emerald-700">DV parameters</span> represent external disturbances and lab-analyzed values.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
