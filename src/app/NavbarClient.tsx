'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flex, Text, Box } from "@radix-ui/themes";
import { Activity, Home, GitFork } from 'lucide-react';

export default function NavbarClient() {
  const pathname = usePathname();
  
  return (
    <Flex justify="between" align="center" py="4">
      <Link href="/" className="no-underline text-foreground">
        <Text size="5" weight="bold">OK Dashboard</Text>
      </Link>
      
      <Flex gap="4" align="center">
        <Link 
          href="/" 
          className={`no-underline flex items-center gap-2 px-3 py-2 rounded-md ${pathname === '/' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}`}
        >
          <Home size={16} />
          <Text>Home</Text>
        </Link>
        
        <Link 
          href="/dashboard" 
          className={`no-underline flex items-center gap-2 px-3 py-2 rounded-md ${pathname === '/dashboard' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}`}
        >
          <Activity size={16} />
          <Text>KPI Dashboard</Text>
        </Link>
        
        <Link 
          href="/mills" 
          className={`no-underline flex items-center gap-2 px-3 py-2 rounded-md ${pathname === '/mills' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}`}
        >
          <GitFork size={16} />
          <Text>Mills</Text>
        </Link>
      </Flex>
    </Flex>
  );
}
