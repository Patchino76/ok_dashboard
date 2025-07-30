import { Card, Flex, Heading, Text, Box } from "@radix-ui/themes";
import { AreaChart } from 'lucide-react';

export default function TendencesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mb-6">
        <Flex direction="column" p="5">
          <Flex align="center" gap="3" mb="4">
            <Box className="p-2 bg-amber-50 rounded-md text-amber-600">
              <AreaChart className="h-5 w-5" />
            </Box>
            <Heading size="6">Тенденции в данните</Heading>
          </Flex>
          
          <Text className="text-gray-700 mb-6">
            Анализирайте исторически данни и идентифицирайте тенденции в производителността на мелниците.
          </Text>
          
          <Card variant="classic" className="bg-gray-50">
            <Text size="2" className="text-gray-500 italic">
              Този раздел е в процес на разработка. Очаквайте скоро възможности за анализ на тенденции в данните.
            </Text>
          </Card>
        </Flex>
      </Card>
    </div>
  );
}
