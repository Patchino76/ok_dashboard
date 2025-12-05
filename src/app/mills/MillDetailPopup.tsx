"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface MillDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  millName: string;
}

const MillDetailPopup: React.FC<MillDetailPopupProps> = ({
  isOpen,
  onClose,
  millName,
}) => {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setRotation((r) => (r + 2) % 360);
    }, 50);
    return () => clearInterval(interval);
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[1100px] h-[90vh] max-h-[800px] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b bg-slate-900/50">
          <DialogTitle className="text-xl text-slate-100">
            {millName}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Схема на процеса на смилане
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 bg-slate-950 overflow-auto p-4">
          <svg
            viewBox="-10 40 900 680"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Gradients */}
              <linearGradient
                id="millBodyGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="50%" stopColor="#475569" />
                <stop offset="100%" stopColor="#334155" />
              </linearGradient>
              <linearGradient
                id="millInnerGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient
                id="motorGradient"
                x1="0%"
                y1="100%"
                x2="0%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#b45309" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
              <linearGradient
                id="pipeGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="50%" stopColor="#475569" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient
                id="pipeHorizontal"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#64748b" />
                <stop offset="50%" stopColor="#475569" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient
                id="pumpGradient"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#475569" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient
                id="coneGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>

              {/* Arrow markers - red is base size, others are half */}
              <marker
                id="arrowBlue"
                markerWidth="4"
                markerHeight="4"
                refX="2"
                refY="2"
                orient="auto-start-reverse"
              >
                <path d="M 0 0.5 L 3 2 L 0 3.5 Z" fill="#3b82f6" />
              </marker>
              <marker
                id="arrowOrange"
                markerWidth="4"
                markerHeight="4"
                refX="2"
                refY="2"
                orient="auto-start-reverse"
              >
                <path d="M 0 0.5 L 3 2 L 0 3.5 Z" fill="#fb923c" />
              </marker>
              <marker
                id="arrowRed"
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 6 4 L 0 7 Z" fill="#ef4444" />
              </marker>
              <marker
                id="arrowGray"
                markerWidth="4"
                markerHeight="4"
                refX="2"
                refY="2"
                orient="auto-start-reverse"
              >
                <path d="M 0 0.5 L 3 2 L 0 3.5 Z" fill="#94a3b8" />
              </marker>

              {/* Flow animation pattern - right direction */}
              <pattern
                id="flowPattern"
                patternUnits="userSpaceOnUse"
                width="20"
                height="10"
                patternTransform="rotate(0)"
              >
                <rect width="10" height="10" fill="#fb923c" opacity="0.6">
                  <animate
                    attributeName="x"
                    from="0"
                    to="20"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </rect>
              </pattern>

              {/* Flow animation pattern - left direction (reverse) */}
              <pattern
                id="flowPatternReverse"
                patternUnits="userSpaceOnUse"
                width="20"
                height="10"
                patternTransform="rotate(0)"
              >
                <rect width="10" height="10" fill="#fb923c" opacity="0.6">
                  <animate
                    attributeName="x"
                    from="20"
                    to="0"
                    dur="1.2s"
                    repeatCount="indefinite"
                  />
                </rect>
              </pattern>

              {/* Glow filter */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background grid */}
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#1e293b"
                strokeWidth="0.5"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ORE FEED HOPPER */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(15, 80)">
              {/* Hopper shape - trapezoid */}
              <path
                d="M 20 0 L 100 0 L 85 60 L 35 60 Z"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="2"
              />
              <path
                d="M 35 60 L 85 60 L 85 80 L 35 80 Z"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="2"
              />

              {/* Ore inside */}
              <path
                d="M 25 10 L 95 10 L 82 55 L 38 55 Z"
                fill="#78716c"
                opacity="0.6"
              />

              <text
                x="60"
                y="-10"
                fontSize="13"
                fill="#cbd5e1"
                textAnchor="middle"
                fontWeight="bold"
              >
                БУНКЕРИ
              </text>
            </g>

            {/* Ore feed rate - in rounded rectangle to the left of hopper */}
            <g transform="translate(55, 180)">
              <rect
                x="-85"
                y="0"
                width="85"
                height="45"
                rx="5"
                fill="#1e293b"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <text
                x="-42"
                y="18"
                fontSize="9"
                fill="#a16207"
                textAnchor="middle"
                fontWeight="bold"
              >
                РАЗХОД РУДА
              </text>
              <text
                x="-42"
                y="35"
                fontSize="12"
                fill="#22c55e"
                textAnchor="middle"
                fontWeight="bold"
              >
                45.2 t/h
              </text>
            </g>

            {/* Ore feed pipe to mill */}
            <path
              d="M 75 160 L 75 200 L 170 200"
              stroke="url(#pipeHorizontal)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 80 200 L 165 200"
              stroke="url(#flowPattern)"
              strokeWidth="6"
              fill="none"
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* WATER INPUT */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(10, 260)">
              <rect
                x="0"
                y="0"
                width="120"
                height="45"
                rx="5"
                fill="#1e293b"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <text
                x="60"
                y="18"
                fontSize="8"
                fill="#60a5fa"
                textAnchor="middle"
                fontWeight="bold"
              >
                ВОДА В МЕЛНИЦАТА
              </text>
              <text
                x="60"
                y="35"
                fontSize="12"
                fill="#22c55e"
                textAnchor="middle"
                fontWeight="bold"
              >
                12.5 m³/h
              </text>
            </g>

            {/* Water pipe to mill */}
            <path
              d="M 130 282 L 170 282 L 170 280"
              stroke="#3b82f6"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              markerEnd="url(#arrowBlue)"
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* BALL MILL - Horizontal cylinder */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(170, 120)">
              {/* Mill body - horizontal cylinder */}
              <ellipse
                cx="0"
                cy="100"
                rx="25"
                ry="80"
                fill="url(#millBodyGradient)"
                stroke="#64748b"
                strokeWidth="2"
              />
              <rect
                x="0"
                y="20"
                width="160"
                height="160"
                fill="url(#millBodyGradient)"
                stroke="none"
              />
              <ellipse
                cx="160"
                cy="100"
                rx="25"
                ry="80"
                fill="url(#millBodyGradient)"
                stroke="#64748b"
                strokeWidth="2"
              />

              {/* Mill inner visible area */}
              <ellipse
                cx="0"
                cy="100"
                rx="18"
                ry="65"
                fill="url(#millInnerGradient)"
              />

              {/* Rotating liner pattern */}
              <g transform={`rotate(${rotation}, 80, 100)`}>
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <line
                    key={i}
                    x1="80"
                    y1="100"
                    x2={80 + 55 * Math.cos((angle * Math.PI) / 180)}
                    y2={100 + 55 * Math.sin((angle * Math.PI) / 180)}
                    stroke="#64748b"
                    strokeWidth="2"
                    opacity="0.5"
                  />
                ))}
                {/* Balls inside */}
                <circle
                  cx="60"
                  cy="85"
                  r="10"
                  fill="#9ca3af"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                <circle
                  cx="100"
                  cy="90"
                  r="12"
                  fill="#9ca3af"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                <circle
                  cx="75"
                  cy="115"
                  r="8"
                  fill="#78716c"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                <circle
                  cx="95"
                  cy="120"
                  r="9"
                  fill="#9ca3af"
                  stroke="#64748b"
                  strokeWidth="1"
                />
                <circle
                  cx="65"
                  cy="105"
                  r="7"
                  fill="#78716c"
                  stroke="#64748b"
                  strokeWidth="1"
                />
              </g>

              {/* Mill label */}
              <text
                x="80"
                y="-5"
                fontSize="14"
                fill="#fbbf24"
                textAnchor="middle"
                fontWeight="bold"
              >
                ТОПКОВА МЕЛНИЦА
              </text>
            </g>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* MOTOR - Proper half circle */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(350, 140)">
              {/* Motor base */}
              <rect
                x="0"
                y="60"
                width="100"
                height="20"
                rx="3"
                fill="#334155"
                stroke="#475569"
                strokeWidth="2"
              />

              {/* Motor body - half circle */}
              <path
                d="M 10 60 A 40 40 0 0 1 90 60"
                fill="url(#motorGradient)"
                stroke="#f59e0b"
                strokeWidth="2"
              />

              {/* Motor cooling fins */}
              {[20, 35, 50, 65, 80].map((x, i) => (
                <rect
                  key={i}
                  x={x}
                  y="25"
                  width="3"
                  height="35"
                  fill="#fbbf24"
                  opacity="0.7"
                />
              ))}

              {/* Motor shaft */}
              <rect
                x="-30"
                y="55"
                width="40"
                height="10"
                fill="#64748b"
                stroke="#475569"
                strokeWidth="1"
              />

              {/* Animated rotating fan/rotor on motor */}
              <g transform={`rotate(${rotation * 3}, 50, 40)`}>
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <line
                    key={i}
                    x1="50"
                    y1="40"
                    x2={50 + 12 * Math.cos((angle * Math.PI) / 180)}
                    y2={40 + 12 * Math.sin((angle * Math.PI) / 180)}
                    stroke="#fbbf24"
                    strokeWidth="2"
                    opacity="0.8"
                  />
                ))}
                <circle cx="50" cy="40" r="5" fill="#f59e0b" />
              </g>

              {/* Shaft coupling */}
              <circle
                cx="-30"
                cy="60"
                r="8"
                fill="#475569"
                stroke="#64748b"
                strokeWidth="2"
              />

              <text
                x="50"
                y="95"
                fontSize="12"
                fill="#fbbf24"
                textAnchor="middle"
                fontWeight="bold"
              >
                ДВИГАТЕЛ
              </text>
              <text
                x="50"
                y="110"
                fontSize="14"
                fill="#22c55e"
                textAnchor="middle"
                fontWeight="bold"
              >
                850 kW
              </text>
              <text
                x="50"
                y="125"
                fontSize="10"
                fill="#94a3b8"
                textAnchor="middle"
              >
                18.5 RPM
              </text>
            </g>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* DISCHARGE from mill to sump */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <path
              d="M 330 300 L 330 440 L 410 440"
              stroke="url(#pipeHorizontal)"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
            />
            {/* Horizontal animation to sump */}
            <path
              d="M 335 440 L 405 440"
              stroke="url(#flowPattern)"
              strokeWidth="8"
              fill="none"
            />
            <text x="375" y="430" fontSize="12" fill="#fb923c" fontWeight="500">
              Пулп
            </text>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SUMP TANK */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(410, 400)">
              {/* Tank body */}
              <rect
                x="0"
                y="0"
                width="100"
                height="90"
                rx="5"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="2"
              />

              {/* Water level */}
              <rect
                x="5"
                y="30"
                width="90"
                height="55"
                rx="3"
                fill="#3b82f6"
                opacity="0.4"
              />
              <rect
                x="5"
                y="30"
                width="90"
                height="5"
                fill="#60a5fa"
                opacity="0.6"
              />

              <text
                x="50"
                y="22"
                fontSize="11"
                fill="#cbd5e1"
                textAnchor="middle"
                fontWeight="bold"
              >
                ЗУМПФ
              </text>
            </g>

            {/* НИВО component - styled like РАЗХОД РУДА */}
            <g transform="translate(520, 430)">
              <rect
                x="0"
                y="0"
                width="85"
                height="45"
                rx="5"
                fill="#1e293b"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <text
                x="42"
                y="18"
                fontSize="9"
                fill="#60a5fa"
                textAnchor="middle"
                fontWeight="bold"
              >
                НИВО
              </text>
              <text
                x="42"
                y="35"
                fontSize="12"
                fill="#22c55e"
                textAnchor="middle"
                fontWeight="bold"
              >
                1730 mm
              </text>
            </g>

            {/* Sump water input - box and pipe pointing to sump */}
            <g transform="translate(20, 452)">
              <rect
                x="0"
                y="0"
                width="100"
                height="45"
                rx="5"
                fill="#1e293b"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <text
                x="50"
                y="16"
                fontSize="9"
                fill="#60a5fa"
                textAnchor="middle"
                fontWeight="bold"
              >
                ВОДА В ЗУМПФ
              </text>
              <text
                x="50"
                y="35"
                fontSize="12"
                fill="#22c55e"
                textAnchor="middle"
                fontWeight="bold"
              >
                8.3 m³/h
              </text>
            </g>
            <path
              d="M 120 475 L 410 475"
              stroke="#3b82f6"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              markerEnd="url(#arrowBlue)"
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PUMP */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(460, 570)">
              {/* Pump casing */}
              <circle
                cx="0"
                cy="0"
                r="30"
                fill="url(#pumpGradient)"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <circle
                cx="0"
                cy="0"
                r="24"
                fill="#1e293b"
                stroke="#475569"
                strokeWidth="1"
              />

              {/* Rotating impeller */}
              <g transform={`rotate(${rotation * 3}, 0, 0)`}>
                {[0, 60, 120, 180, 240, 300].map((angle, i) => (
                  <path
                    key={i}
                    d={`M 0 0 L ${
                      16 * Math.cos(((angle - 20) * Math.PI) / 180)
                    } ${16 * Math.sin(((angle - 20) * Math.PI) / 180)} 
                        Q ${20 * Math.cos((angle * Math.PI) / 180)} ${
                      20 * Math.sin((angle * Math.PI) / 180)
                    } 
                        ${16 * Math.cos(((angle + 20) * Math.PI) / 180)} ${
                      16 * Math.sin(((angle + 20) * Math.PI) / 180)
                    } Z`}
                    fill="#60a5fa"
                    opacity="0.8"
                  />
                ))}
              </g>

              {/* Center hub */}
              <circle
                cx="0"
                cy="0"
                r="6"
                fill="#475569"
                stroke="#60a5fa"
                strokeWidth="2"
              />

              <text
                x="0"
                y="-45"
                fontSize="10"
                fill="#cbd5e1"
                textAnchor="middle"
                fontWeight="bold"
              >
                ПОМПА
              </text>
            </g>

            {/* ОБОРОТИ component - styled like РАЗХОД РУДА */}
            <g transform="translate(500, 590)">
              <rect
                x="0"
                y="0"
                width="85"
                height="45"
                rx="5"
                fill="#1e293b"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <text
                x="42"
                y="18"
                fontSize="9"
                fill="#60a5fa"
                textAnchor="middle"
                fontWeight="bold"
              >
                ОБОРОТИ
              </text>
              <text
                x="42"
                y="35"
                fontSize="12"
                fill="#22c55e"
                textAnchor="middle"
                fontWeight="bold"
              >
                800 rpm
              </text>
            </g>

            {/* Pipe from sump to pump */}
            <path
              d="M 460 490 L 460 540"
              stroke="url(#pipeGradient)"
              strokeWidth="10"
              fill="none"
            />

            {/* Pipe from pump through sensors to hydrocyclone TOP */}
            <path
              d="M 490 570 L 680 570 L 680 170 L 730 170"
              stroke="url(#pipeGradient)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
            />
            {/* Horizontal animated section to cyclone - starts after vertical pipe */}
            <path
              d="M 685 170 L 725 170"
              stroke="url(#flowPattern)"
              strokeWidth="6"
              fill="none"
            />
            {/* Horizontal animated section from pump */}
            <path
              d="M 495 570 L 675 570"
              stroke="url(#flowPattern)"
              strokeWidth="6"
              fill="none"
            />

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PRE-CYCLONE SENSORS - to the right of vertical pipe */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(700, 420)">
              <rect
                x="0"
                y="0"
                width="120"
                height="90"
                rx="5"
                fill="#0f172a"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <text
                x="60"
                y="18"
                fontSize="11"
                fill="#60a5fa"
                textAnchor="middle"
                fontWeight="bold"
              >
                СЕНЗОРИ
              </text>

              <text x="10" y="38" fontSize="9" fill="#94a3b8">
                Дебит пулп:
              </text>
              <text
                x="110"
                y="38"
                fontSize="10"
                fill="#22c55e"
                textAnchor="end"
                fontWeight="bold"
              >
                156 m³/h
              </text>

              <text x="10" y="54" fontSize="9" fill="#94a3b8">
                Налягане:
              </text>
              <text
                x="110"
                y="54"
                fontSize="10"
                fill="#22c55e"
                textAnchor="end"
                fontWeight="bold"
              >
                185 kPa
              </text>

              <text x="10" y="70" fontSize="9" fill="#94a3b8">
                Плътност:
              </text>
              <text
                x="110"
                y="70"
                fontSize="10"
                fill="#22c55e"
                textAnchor="end"
                fontWeight="bold"
              >
                1.65 g/cm³
              </text>

              {/* Status indicator */}
              <circle cx="60" cy="82" r="4" fill="#22c55e" filter="url(#glow)">
                <animate
                  attributeName="opacity"
                  values="1;0.5;1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HYDROCYCLONE - Smaller cone shape */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(760, 120)">
              {/* Top cylinder - smaller */}
              <ellipse
                cx="0"
                cy="35"
                rx="28"
                ry="8"
                fill="#475569"
                stroke="#64748b"
                strokeWidth="2"
              />
              <rect
                x="-28"
                y="35"
                width="56"
                height="28"
                fill="url(#coneGradient)"
                stroke="none"
              />
              <ellipse
                cx="0"
                cy="63"
                rx="28"
                ry="8"
                fill="#475569"
                stroke="#64748b"
                strokeWidth="2"
              />

              {/* Cone body - smaller */}
              <path
                d="M -28 63 L 0 140 L 28 63"
                fill="url(#coneGradient)"
                stroke="#64748b"
                strokeWidth="2"
              />

              {/* Vortex finder (overflow pipe) - smaller */}
              <rect
                x="-8"
                y="15"
                width="16"
                height="35"
                fill="#334155"
                stroke="#64748b"
                strokeWidth="2"
              />
              <ellipse
                cx="0"
                cy="15"
                rx="8"
                ry="3"
                fill="#475569"
                stroke="#64748b"
                strokeWidth="1"
              />

              {/* Animated swirling particle inside cyclone */}
              <g>
                {/* Rotating small ellipse simulating pulp rotation */}
                <ellipse
                  cx={12 * Math.cos(rotation * 0.15)}
                  cy={80 + 5 * Math.sin(rotation * 0.1)}
                  rx="4"
                  ry="2"
                  fill="#60a5fa"
                  opacity="0.7"
                />
                <ellipse
                  cx={8 * Math.cos(rotation * 0.15 + Math.PI)}
                  cy={95 + 3 * Math.sin(rotation * 0.1)}
                  rx="3"
                  ry="1.5"
                  fill="#3b82f6"
                  opacity="0.6"
                />
                <ellipse
                  cx={4 * Math.cos(rotation * 0.15 + Math.PI / 2)}
                  cy={110 + 2 * Math.sin(rotation * 0.1)}
                  rx="2"
                  ry="1"
                  fill="#93c5fd"
                  opacity="0.5"
                />
              </g>

              {/* Hydrocyclone label - on right side */}
              <text
                x="45"
                y="70"
                fontSize="11"
                fill="#cbd5e1"
                textAnchor="start"
                fontWeight="bold"
              >
                ХИДРОЦИКЛОН
              </text>
            </g>

            {/* Overflow pipe to flotation - with animation */}
            <path
              d="M 760 135 L 760 80 L 870 80"
              stroke="url(#pipeHorizontal)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 765 80 L 865 80"
              stroke="url(#flowPattern)"
              strokeWidth="6"
              fill="none"
            />
            {/* Label above the pipe */}
            <text
              x="815"
              y="65"
              fontSize="10"
              fill="#fb923c"
              textAnchor="middle"
              fontWeight="bold"
            >
              ПУЛП КЪМ ФЛОТАЦИЯ
            </text>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PSM300 SENSOR - enlarged with two values */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <g transform="translate(610, 60)">
              <rect
                x="0"
                y="0"
                width="130"
                height="70"
                rx="5"
                fill="#0f172a"
                stroke="#fb923c"
                strokeWidth="2"
              />
              <text
                x="65"
                y="18"
                fontSize="11"
                fill="#fb923c"
                textAnchor="middle"
                fontWeight="bold"
              >
                PSM300
              </text>
              <text x="10" y="38" fontSize="9" fill="#94a3b8">
                -80 мк:
              </text>
              <text
                x="120"
                y="38"
                fontSize="10"
                fill="#22c55e"
                textAnchor="end"
                fontWeight="bold"
              >
                45.2%
              </text>
              <text x="10" y="55" fontSize="9" fill="#94a3b8">
                +200 мк:
              </text>
              <text
                x="120"
                y="55"
                fontSize="10"
                fill="#22c55e"
                textAnchor="end"
                fontWeight="bold"
              >
                12.8%
              </text>
            </g>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* UNDERFLOW RETURN TO MILL - from bottom of cyclone */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* Return pipe from cyclone bottom back to mill - solid pipe with reverse animation */}
            <path
              d="M 760 300 L 760 340 L 200 340 L 200 300"
              stroke="url(#pipeHorizontal)"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
            />
            {/* Horizontal animation going LEFT */}
            <path
              d="M 755 340 L 205 340"
              stroke="url(#flowPatternReverse)"
              strokeWidth="6"
              fill="none"
            />
            {/* ЦИРКУЛАЦИОНЕН ТОВАР component - styled like РАЗХОД РУДА */}
            <g transform="translate(430, 285)">
              <rect
                x="0"
                y="0"
                width="120"
                height="45"
                rx="5"
                fill="#1e293b"
                stroke="#3b82f6"
                strokeWidth="2"
              />
              <text
                x="60"
                y="18"
                fontSize="8"
                fill="#60a5fa"
                textAnchor="middle"
                fontWeight="bold"
              >
                ЦИРКУЛАЦИОНЕН ТОВАР
              </text>
              <text
                x="60"
                y="35"
                fontSize="12"
                fill="#22c55e"
                textAnchor="middle"
                fontWeight="bold"
              >
                2.1
              </text>
            </g>
          </svg>
        </div>

        <div className="px-6 py-3 border-t bg-slate-900/50 text-xs text-slate-400">
          <p>
            ⚙️ Визуализация в реално време • Затворен цикъл на смилане • PSM300
            мониторинг на размера на частиците
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MillDetailPopup;
