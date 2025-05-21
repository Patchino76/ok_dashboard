'use client';

import Link from 'next/link';
import { Card, Grid, Flex, Heading, Text, Button, Box, Avatar, Badge } from "@radix-ui/themes";
import { BarChart, FileSpreadsheet, Activity, AreaChart, GitFork, Clock, TrendingUp, LayoutDashboard, ArrowRight } from 'lucide-react';

export default function Home() {
  const stats = [
    { label: 'Shift Productivity', value: '93%', trend: '+2.5%', positive: true },
    { label: 'Processed Ore', value: '1,245 t', trend: '-1.2%', positive: false },
    { label: 'Equipment Uptime', value: '98%', trend: '+0.8%', positive: true }
  ];

  return (
    <div>
      {/* Welcome section */}
      <Box className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <Flex justify="between" align="center">
          <Box>
            <Heading size="7" mb="1">Табло</Heading>
            <Text size="3" className="text-gray-500">Добре дошли в контролния панел на Елаците-Мед</Text>
          </Box>
          <Box className="flex items-center gap-4">
            <Box className="hidden md:block">
              <Flex align="center" gap="2">
                <Clock className="text-gray-400 h-4 w-4" />
                <Text size="2" className="text-gray-500">{new Date().toLocaleDateString('bg-BG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
              </Flex>
            </Box>
          </Box>
        </Flex>
      </Box>
      
      {/* Stats overview */}
      <Box className="mb-6">
        <Heading size="4" mb="3">Обзор за деня</Heading>
        <Grid columns={{ initial: "1", sm: "3" }} gap="4">
          {stats.map((stat, index) => (
            <Card key={index} className="bg-white shadow-sm">
              <Flex direction="column" gap="1" p="4">
                <Text size="2" className="text-gray-500">{stat.label}</Text>
                <Flex justify="between" align="center">
                  <Heading size="6">{stat.value}</Heading>
                  <Badge color={stat.positive ? 'green' : 'red'} variant="soft">
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
        <Heading size="4" mb="3">Контролни панели</Heading>
        <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
          <Link href="/dashboard" className="no-underline">
            <Card className="bg-white h-full hover:shadow-md transition-shadow cursor-pointer overflow-hidden group border-l-4 border-l-green-500">
              <Flex direction="column" p="5" height="100%">
                <Flex justify="between" align="center" mb="3">
                  <Box className="p-2 bg-green-50 rounded-md text-green-600">
                    <Activity className="h-5 w-5" />
                  </Box>
                  <Box className="size-8 flex items-center justify-center rounded-full bg-green-50 group-hover:bg-green-100 transition-colors">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                  </Box>
                </Flex>
                <Heading size="4" mb="2">Производствени KPI</Heading>
                <Text className="text-gray-500 mb-2">Анализирайте производителността и KPI на диспечерите</Text>
                <Box className="mt-auto">
                  <Badge size="1" variant="soft" color="green">Активен</Badge>
                </Box>
              </Flex>
            </Card>
          </Link>
          
          <Link href="/mills" className="no-underline">
            <Card className="bg-white h-full hover:shadow-md transition-shadow cursor-pointer overflow-hidden group border-l-4 border-l-blue-500">
              <Flex direction="column" p="5" height="100%">
                <Flex justify="between" align="center" mb="3">
                  <Box className="p-2 bg-blue-50 rounded-md text-blue-600">
                    <GitFork className="h-5 w-5" />
                  </Box>
                  <Box className="size-8 flex items-center justify-center rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
                    <ArrowRight className="h-4 w-4 text-blue-600" />
                  </Box>
                </Flex>
                <Heading size="4" mb="2">Операции на мелниците</Heading>
                <Text className="text-gray-500 mb-2">Следете производителността, консумацията на руда и смените</Text>
                <Box className="mt-auto">
                  <Badge size="1" variant="soft" color="blue">Активен</Badge>
                </Box>
              </Flex>
            </Card>
          </Link>
          
          <Card className="bg-white h-full hover:shadow-md transition-shadow cursor-pointer overflow-hidden group border-l-4 border-l-purple-500">
            <Flex direction="column" p="5" height="100%">
              <Flex justify="between" align="center" mb="3">
                <Box className="p-2 bg-purple-50 rounded-md text-purple-600">
                  <BarChart className="h-5 w-5" />
                </Box>
                <Box className="size-8 flex items-center justify-center rounded-full bg-purple-50 group-hover:bg-purple-100 transition-colors">
                  <ArrowRight className="h-4 w-4 text-purple-600" />
                </Box>
              </Flex>
              <Heading size="4" mb="2">Анализ на ефективността</Heading>
              <Text className="text-gray-500 mb-2">Следете индикаторите за производителност по екипи и смени</Text>
              <Box className="mt-auto">
                <Badge size="1" variant="soft" color="gray">Очаквайте скоро</Badge>
              </Box>
            </Flex>
          </Card>
          
          <Card className="bg-white h-full hover:shadow-md transition-shadow cursor-pointer overflow-hidden group border-l-4 border-l-amber-500">
            <Flex direction="column" p="5" height="100%">
              <Flex justify="between" align="center" mb="3">
                <Box className="p-2 bg-amber-50 rounded-md text-amber-600">
                  <AreaChart className="h-5 w-5" />
                </Box>
                <Box className="size-8 flex items-center justify-center rounded-full bg-amber-50 group-hover:bg-amber-100 transition-colors">
                  <ArrowRight className="h-4 w-4 text-amber-600" />
                </Box>
              </Flex>
              <Heading size="4" mb="2">Тенденции в данните</Heading>
              <Text className="text-gray-500 mb-2">Анализирайте исторически данни и идентифицирайте тенденции</Text>
              <Box className="mt-auto">
                <Badge size="1" variant="soft" color="gray">Очаквайте скоро</Badge>
              </Box>
            </Flex>
          </Card>
        </Grid>
      </Box>
      
      {/* Data import section */}
      <Box className="mb-6">
        <Heading size="4" mb="3">Инструменти за данни</Heading>
        <Card className="bg-white hover:shadow-md transition-shadow cursor-pointer overflow-hidden group border-l-4 border-l-cyan-500">
          <Flex direction="column" p="5">
            <Flex justify="between" align="center" mb="3">
              <Box className="p-2 bg-cyan-50 rounded-md text-cyan-600">
                <FileSpreadsheet className="h-5 w-5" />
              </Box>
              <Box className="size-8 flex items-center justify-center rounded-full bg-cyan-50 group-hover:bg-cyan-100 transition-colors">
                <ArrowRight className="h-4 w-4 text-cyan-600" />
              </Box>
            </Flex>
            <Heading size="4" mb="2">Импорт на данни на диспечери</Heading>
            <Text className="text-gray-500 mb-4">Импортирайте и обработвайте данни на диспечери от Excel файлове</Text>
            <Text size="2" className="text-gray-400 mb-2">
              Поддържа файлове като Doklad_Dispecheri_2024.xlsx с автоматично извличане на годината
            </Text>
            <Box>
              <Badge size="1" variant="soft" color="gray">Очаквайте скоро</Badge>
            </Box>
          </Flex>
        </Card>
      </Box>
    </div>
  );
}
