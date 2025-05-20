'use client';

import Link from 'next/link';
import { Card, Grid, Flex, Heading, Text, Button } from "@radix-ui/themes";
import { BarChart, FileSpreadsheet, Activity, AreaChart, GitFork } from 'lucide-react';

export default function Home() {
  return (
    <div className="p-4">
      <Heading size="6" mb="2">OK Dashboard</Heading>
      <Text className="text-muted-foreground mb-6">Select a dashboard module to get started</Text>
      
      <Grid columns={{ initial: "1", sm: "2", md: "3" }} gap="4">
        <Link href="/dashboard" className="no-underline">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <Flex direction="column" gap="2" p="4" height="100%">
              <Flex justify="between" align="center" mb="2">
                <Heading size="4">Dispatcher KPIs</Heading>
                <Activity className="text-primary h-5 w-5" />
              </Flex>
              <Text>View performance metrics and KPIs for dispatcher operations</Text>
              <Flex mt="auto" pt="2">
                <Button variant="soft" size="2">Open Dashboard</Button>
              </Flex>
            </Flex>
          </Card>
        </Link>
        
        <Link href="/mills" className="no-underline">
          <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
            <Flex direction="column" gap="2" p="4" height="100%">
              <Flex justify="between" align="center" mb="2">
                <Heading size="4">Mills Operations</Heading>
                <GitFork className="text-primary h-5 w-5" />
              </Flex>
              <Text>Monitor mills performance, ore consumption and shift totals</Text>
              <Flex mt="auto" pt="2">
                <Button variant="soft" size="2">Open Mills</Button>
              </Flex>
            </Flex>
          </Card>
        </Link>
        
        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
          <Flex direction="column" gap="2" p="4" height="100%">
            <Flex justify="between" align="center" mb="2">
              <Heading size="4">Performance Analytics</Heading>
              <BarChart className="text-primary h-5 w-5" />
            </Flex>
            <Text>Track performance indicators across teams and shifts</Text>
            <Flex mt="auto" pt="2">
              <Button variant="soft" size="2">Coming Soon</Button>
            </Flex>
          </Flex>
        </Card>
        
        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
          <Flex direction="column" gap="2" p="4" height="100%">
            <Flex justify="between" align="center" mb="2">
              <Heading size="4">Data Trends</Heading>
              <AreaChart className="text-primary h-5 w-5" />
            </Flex>
            <Text>Analyze historical data and identify trends</Text>
            <Flex mt="auto" pt="2">
              <Button variant="soft" size="2">Coming Soon</Button>
            </Flex>
          </Flex>
        </Card>
      </Grid>
      
      <Grid columns={{ initial: "1" }} gap="4" mt="4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <Flex direction="column" gap="2" p="4">
            <Flex justify="between" align="center" mb="2">
              <Heading size="4">Dispatcher Data Import</Heading>
              <FileSpreadsheet className="text-primary h-5 w-5" />
            </Flex>
            <Text>Import and process dispatcher data from Excel files</Text>
            <Text size="1" className="text-muted-foreground mt-2">
              Supports files like Doklad_Dispecheri_2024.xlsx with automatic year extraction
            </Text>
            <Flex mt="2">
              <Button variant="soft" size="2">Coming Soon</Button>
            </Flex>
          </Flex>
        </Card>
      </Grid>
    </div>
  );
}
