'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Flex, Text, Box, Separator } from "@radix-ui/themes";
import { 
  LayoutDashboard, 
  TrendingUp, 
  BarChart3, 
  Share2, 
  Users, 
  Settings, 
  Home,
  CircleDashed,
  GitFork,
  Menu,
  X
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  
  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);
  
  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (isMobileOpen && (event.target as HTMLElement).closest('.sidebar-content') === null && 
          (event.target as HTMLElement).closest('.mobile-menu-button') === null) {
        setIsMobileOpen(false);
      }
    };
    
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isMobileOpen]);
  
  const menuItems = [
    { href: '/', label: 'Табло', icon: <Home className="w-5 h-5" /> },
    { href: '/dashboard', label: 'Производствени KPI', icon: <TrendingUp className="w-5 h-5" /> },
    { href: '/mills', label: 'Параметри на мелнично', icon: <GitFork className="w-5 h-5" /> },
    { href: '/performance', label: 'Показатели за ефективност', icon: <BarChart3 className="w-5 h-5" /> },
    { href: '/resources', label: 'Разпределение на ресурси', icon: <Share2 className="w-5 h-5" /> },
    { href: '/personnel', label: 'Персонал', icon: <Users className="w-5 h-5" /> },
    { href: '/settings', label: 'Настройки', icon: <Settings className="w-5 h-5" /> },
  ];
  
  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        className="mobile-menu-button fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-md shadow-md border border-gray-200"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
      
      {/* Sidebar Content - Hidden on mobile unless open */}
      <Box 
        className={`sidebar-content fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 py-4 w-[280px] flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:w-60`}
      >
      <Box className="px-4 py-2 mb-4">
        <Flex align="center" justify="center">
          <Box className="w-full flex justify-center">
            <Image 
              src="/images/Ellatzite/em_full_logo.jpg" 
              alt="Елаците-Мед Logo" 
              width={150}
              height={50}
              style={{ objectFit: 'contain', maxHeight: '50px' }}
              priority
            />
          </Box>
        </Flex>
      </Box>
      
      <Separator size="4" />
      
      <Box className="flex-1 mt-4">
        <nav>
          <Flex direction="column" gap="1">
            {menuItems.map((item) => (
              <Link 
                key={item.href}
                href={item.href} 
                className={`no-underline flex items-center gap-3 px-6 py-2.5 text-sm ${
                  pathname === item.href 
                    ? 'bg-gray-100 text-emerald-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Box className={pathname === item.href ? 'text-emerald-600' : 'text-gray-500'}>
                  {item.icon}
                </Box>
                <Text>{item.label}</Text>
              </Link>
            ))}
          </Flex>
        </nav>
      </Box>
      
      <Box className="px-6 py-4 mt-auto border-t border-gray-200">
        <Flex align="center" gap="2">
          <Box className="text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13Z" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 22C16 18 20 14.4183 20 11C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 11C4 14.4183 8 18 12 22Z" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </Box>
          <Text size="2" className="text-gray-500">Етрополе, Мирково</Text>
        </Flex>
      </Box>
      </Box>
      
      {/* Overlay when mobile sidebar is open */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}