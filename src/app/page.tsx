"use client";

import Link from "next/link";
import {
  Card,
  Grid,
  Flex,
  Heading,
  Text,
  Button,
  Box,
  Avatar,
  Badge,
} from "@radix-ui/themes";
import {
  BarChart,
  FileSpreadsheet,
  Activity,
  AreaChart,
  GitFork,
  Clock,
  TrendingUp,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { useDashboardTags } from "@/hooks/useDashboardTags";
import { formatNumber } from "@/lib/utils";

export default function Home() {
  // Fetch the three specific tag values
  const { data: tagData, loading } = useDashboardTags([
    "MFC-MILLS_SUMORE_1_11", // МФЦ: Разход на руда
    "RECOVERY_LINEALL_CU_LONG", // Общo извличане
    "CUFLOTAS2-S7-400PV_CU_LINE_10", // Технологичен концентрат
  ]);

  // Extract and type-narrow tag values
  const mfcOre =
    typeof tagData?.["MFC-MILLS_SUMORE_1_11"]?.value === "number"
      ? (tagData?.["MFC-MILLS_SUMORE_1_11"]?.value as number)
      : 0;

  const recovery =
    typeof tagData?.["RECOVERY_LINEALL_CU_LONG"]?.value === "number"
      ? (tagData?.["RECOVERY_LINEALL_CU_LONG"]?.value as number)
      : 0;

  const concentrate =
    typeof tagData?.["CUFLOTAS2-S7-400PV_CU_LINE_10"]?.value === "number"
      ? (tagData?.["CUFLOTAS2-S7-400PV_CU_LINE_10"]?.value as number)
      : 0;

  // Format the stats for display
  const stats = [
    {
      label: "Мелнично: Разход на руда",
      value: loading ? "..." : `${formatNumber(mfcOre, 0)} t/h`,
      trend: mfcOre > 2000 ? "+5.2%" : "-2.1%",
      positive: mfcOre > 2000,
      active: tagData?.["MFC-MILLS_SUMORE_1_11"]?.active ?? false,
    },
    {
      label: "Флотация: Общо извличане",
      value: loading ? "..." : `${formatNumber(recovery, 1)}%`,
      trend: recovery > 85 ? "+3.7%" : "-1.5%",
      positive: recovery > 85,
      active: tagData?.["RECOVERY_LINEALL_CU_LONG"]?.active ?? false,
    },
    {
      label: "Флотация: Технологичен концентрат",
      value: loading ? "..." : `${formatNumber(concentrate, 1)}%`,
      trend: concentrate > 25 ? "+2.3%" : "-0.8%",
      positive: concentrate > 25,
      active: tagData?.["CUFLOTAS2-S7-400PV_CU_LINE_10"]?.active ?? false,
    },
  ];

  return (
    <div>
      {/* Welcome section */}
      <Box className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <Flex justify="between" align="center">
          <Box>
            <Heading size="7" mb="1">
              Табло Profimine
            </Heading>
            <Text size="3" className="text-gray-500">
              Добре дошли в контролния панел на Елаците-Мед
            </Text>
          </Box>
          <Box className="flex items-center gap-4">
            <Box className="hidden md:block">
              <Flex align="center" gap="2">
                <Clock className="text-gray-400 h-4 w-4" />
                <Text size="2" className="text-gray-500">
                  {new Date().toLocaleDateString("bg-BG", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </Flex>
            </Box>
          </Box>
        </Flex>
      </Box>

      {/* Stats overview */}
      <Box className="mb-6">
        <Heading size="4" mb="3">
          Обзор за деня
        </Heading>
        <Grid columns={{ initial: "1", sm: "3" }} gap="4">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className={`bg-white shadow-sm ${
                !stat.active ? "opacity-70" : ""
              }`}
            >
              <Flex direction="column" gap="1" p="4">
                <Flex justify="between" align="center">
                  <Text size="2" className="text-gray-500">
                    {stat.label}
                  </Text>
                  {!stat.active && (
                    <Badge size="1" variant="soft" color="gray">
                      Неактивен
                    </Badge>
                  )}
                </Flex>
                <Flex justify="between" align="center">
                  <Heading size="6">{stat.value}</Heading>
                  <Badge color={stat.positive ? "green" : "red"} variant="soft">
                    <Flex align="center" gap="1">
                      <TrendingUp className="h-3 w-3" />
                      <Text size="1">{stat.trend}</Text>
                    </Flex>
                  </Badge>
                </Flex>
              </Flex>
            </Card>
          ))}
        </Grid>
      </Box>

      {/* Dashboard modules */}
      <Box className="mb-6">
        <Heading size="4" mb="3">
          Контролни панели
        </Heading>
        <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
          <Link href="/dashboard" className="no-underline">
            <Card className="bg-gradient-to-br from-white to-green-50/50 h-full hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden group border-0 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-400" />
              <Flex direction="column" p="5" height="100%">
                <Flex justify="between" align="center" mb="3">
                  <Box className="p-3 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg shadow-lg">
                    <Activity className="h-5 w-5 text-white" />
                  </Box>
                  <Box className="size-8 flex items-center justify-center rounded-full bg-green-50 group-hover:bg-green-100 transition-colors">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                  </Box>
                </Flex>
                <Heading
                  size="4"
                  mb="2"
                  className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent"
                >
                  Производствени KPI
                </Heading>
                <Text className="text-gray-500 mb-2">
                  Анализирайте производителността и KPI на диспечерите
                </Text>
                <Box className="mt-auto">
                  <Badge
                    size="1"
                    variant="soft"
                    style={{ backgroundColor: "#dcfce7", color: "#059669" }}
                  >
                    Активен
                  </Badge>
                </Box>
              </Flex>
            </Card>
          </Link>

          <Link href="/mills" className="no-underline">
            <Card className="bg-gradient-to-br from-white to-blue-50/50 h-full hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden group border-0 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-400" />
              <Flex direction="column" p="5" height="100%">
                <Flex justify="between" align="center" mb="3">
                  <Box className="p-3 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg shadow-lg">
                    <GitFork className="h-5 w-5 text-white" />
                  </Box>
                  <Box className="size-8 flex items-center justify-center rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                  </Box>
                </Flex>
                <Heading
                  size="4"
                  mb="2"
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent"
                >
                  Операции на мелниците
                </Heading>
                <Text className="text-gray-500 mb-2">
                  Следете производителността, консумацията на руда и смените
                </Text>
                <Box className="mt-auto">
                  <Badge
                    size="1"
                    variant="soft"
                    style={{ backgroundColor: "#dbeafe", color: "#2563eb" }}
                  >
                    Активен
                  </Badge>
                </Box>
              </Flex>
            </Card>
          </Link>

          <Link href="/analytics" className="no-underline">
            <Card className="bg-gradient-to-br from-white to-violet-50/50 h-full hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden group border-0 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-400 to-purple-400" />
              <Flex direction="column" p="5" height="100%">
                <Flex justify="between" align="center" mb="3">
                  <Box className="p-3 bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg shadow-lg">
                    <BarChart className="h-5 w-5 text-white" />
                  </Box>
                  <Box className="size-8 flex items-center justify-center rounded-full bg-violet-50 group-hover:bg-violet-100 transition-colors">
                    <ArrowRight className="h-4 w-4 text-violet-600" />
                  </Box>
                </Flex>
                <Heading
                  size="4"
                  mb="2"
                  className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent"
                >
                  Аналитики на смилане
                </Heading>
                <Text className="text-gray-500 mb-2">
                  Следете индикаторите за производителност по екипи и смени
                </Text>
                <Box className="mt-auto">
                  <Badge
                    size="1"
                    variant="soft"
                    style={{ backgroundColor: "#f5f3ff", color: "#7c3aed" }}
                  >
                    Очаквайте скоро
                  </Badge>
                </Box>
              </Flex>
            </Card>
          </Link>

          <Link href="/mills-ai/optimization-cascade" className="no-underline">
            <Card className="bg-gradient-to-br from-white to-purple-50/50 h-full hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden group border-0 shadow-lg">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-indigo-400" />
              <Flex direction="column" p="5" height="100%">
                <Flex justify="between" align="center" mb="3">
                  <Box className="p-3 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg shadow-lg">
                    <svg
                      className="h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </Box>
                  <Box className="size-8 flex items-center justify-center rounded-full bg-purple-50 group-hover:bg-purple-100 transition-colors">
                    <ArrowRight className="h-4 w-4 text-purple-600" />
                  </Box>
                </Flex>
                <Heading
                  size="4"
                  mb="2"
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent"
                >
                  Оптимизация на смилане
                </Heading>
                <Text className="text-gray-500 mb-2">
                  AI-базирана оптимизация на процесите с машинно обучение
                </Text>
                <Box className="mt-auto">
                  <Badge
                    size="1"
                    variant="soft"
                    style={{ backgroundColor: "#f3e8ff", color: "#7c3aed" }}
                  >
                    AI Активен
                  </Badge>
                </Box>
              </Flex>
            </Card>
          </Link>
        </Grid>
      </Box>

      {/* Data import section */}
      <Box className="mb-6">
        <Heading size="4" mb="3">
          Инструменти за данни
        </Heading>
        <Card className="bg-gradient-to-br from-white to-cyan-50/50 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden group border-0 shadow-lg">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 to-teal-400" />
          <Flex direction="column" p="5">
            <Flex justify="between" align="center" mb="3">
              <Box className="p-3 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-lg shadow-lg">
                <FileSpreadsheet className="h-5 w-5 text-white" />
              </Box>
              <Box className="size-8 flex items-center justify-center rounded-full bg-cyan-50 group-hover:bg-cyan-100 transition-colors">
                <ArrowRight className="h-4 w-4 text-cyan-600" />
              </Box>
            </Flex>
            <Heading
              size="4"
              mb="2"
              className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent"
            >
              Импорт на данни на диспечери
            </Heading>
            <Text className="text-gray-500 mb-4">
              Импортирайте и обработвайте данни на диспечери от Excel файлове
            </Text>
            <Text size="2" className="text-gray-400 mb-2">
              Поддържа файлове като Doklad_Dispecheri_2024.xlsx с автоматично
              извличане на годината
            </Text>
            <Box>
              <Badge
                size="1"
                variant="soft"
                style={{ backgroundColor: "#ecfeff", color: "#0891b2" }}
              >
                Очаквайте скоро
              </Badge>
            </Box>
          </Flex>
        </Card>
      </Box>
    </div>
  );
}
