"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Target } from "lucide-react";
import { cascadeBG } from "../translations/bg";
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
        {/* Flow Diagram - All cards on one line */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* MV Parameters */}
          <ParameterGroup
            title={cascadeBG.parameters.manipulated}
            varType="MV"
            parameters={mv_parameters}
            description={cascadeBG.parameters.manipulatedDescription}
          />

          {/* CV Parameters */}
          <ParameterGroup
            title={cascadeBG.parameters.controlled}
            varType="CV"
            parameters={cv_parameters}
            description={cascadeBG.parameters.controlledDescription}
          />

          {/* DV Parameters */}
          <ParameterGroup
            title={cascadeBG.parameters.disturbance}
            varType="DV"
            parameters={dv_parameters}
            description={cascadeBG.parameters.disturbanceDescription}
          />
        </div>
      </CardContent>
    </Card>
  );
}
