"use client";

import { useState, useEffect, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Flex, Text, Box, Separator } from "@radix-ui/themes";
import {
  TrendingUp,
  BarChart3,
  Home,
  CircleDashed,
  GitFork,
  Menu,
  X,
  Zap,
  Factory as FactoryIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type MenuItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const STORAGE_KEY = "sidebar-collapsed";

export default function Sidebar() {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setIsCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        isMobileOpen &&
        (event.target as HTMLElement).closest(".sidebar-content") === null &&
        (event.target as HTMLElement).closest(".mobile-menu-button") === null
      ) {
        setIsMobileOpen(false);
      }
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isMobileOpen]);

  const homeItem: MenuItem = {
    href: "/",
    label: "Табло",
    icon: <Home className="w-5 h-5" />,
  };

  const sections: MenuSection[] = [
    {
      title: "Операции",
      items: [
        {
          href: "/mills",
          label: "Параметри на мелнично",
          icon: <GitFork className="w-5 h-5" />,
        },
        {
          href: "/balls",
          label: "Топки",
          icon: <CircleDashed className="w-5 h-5" />,
        },
        {
          href: "/mills-downtime",
          label: "Престои на мелници",
          icon: <Clock className="w-5 h-5" />,
        },
      ],
    },
    {
      title: "Аналитики",
      items: [
        {
          href: "/dashboard",
          label: "Производствени KPI",
          icon: <TrendingUp className="w-5 h-5" />,
        },
        {
          href: "/mills-forecasting",
          label: "Производство",
          icon: <FactoryIcon className="w-5 h-5" />,
        },
        {
          href: "/analytics",
          label: "Аналитики",
          icon: <BarChart3 className="w-5 h-5" />,
        },
      ],
    },
    {
      title: "AI",
      items: [
        {
          href: "/mills-ai/optimization-cascade",
          label: "Оптимизация на смилане",
          icon: <Zap className="w-5 h-5" />,
        },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const renderMenuItem = (item: MenuItem) => (
    <Link
      key={item.href}
      href={item.href}
      title={isCollapsed ? item.label : undefined}
      className={`no-underline flex items-center gap-3 py-2.5 text-sm transition-colors ${
        isCollapsed ? "justify-center px-2" : "px-6"
      } ${
        isActive(item.href)
          ? "bg-gray-100 text-emerald-600 font-medium"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <Box
        className={`flex-shrink-0 ${
          isActive(item.href) ? "text-emerald-600" : "text-gray-500"
        }`}
      >
        {item.icon}
      </Box>
      {!isCollapsed && <Text>{item.label}</Text>}
    </Link>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="mobile-menu-button fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-md shadow-md border border-gray-200"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Content */}
      <Box
        className={`sidebar-content fixed inset-y-0 left-0 z-40 bg-white border-r border-gray-200 py-4 flex flex-col transform transition-all duration-300 ease-in-out ${
          isMobileOpen
            ? "translate-x-0 w-[280px]"
            : "-translate-x-full w-[280px]"
        } md:translate-x-0 md:relative ${isCollapsed ? "md:w-16" : "md:w-60"}`}
      >
        {/* Logo */}
        <Box className={`py-2 mb-4 ${isCollapsed ? "px-2" : "px-4"}`}>
          <Flex align="center" justify="center">
            <Box className="w-full flex justify-center">
              {isCollapsed ? (
                <Image
                  src="/images/Ellatzite/em_full_logo.jpg"
                  alt="ЕМ"
                  width={32}
                  height={32}
                  style={{ objectFit: "contain", maxHeight: "32px" }}
                  priority
                />
              ) : (
                <Image
                  src="/images/Ellatzite/em_full_logo.jpg"
                  alt="Елаците-Мед Logo"
                  width={150}
                  height={50}
                  style={{ objectFit: "contain", maxHeight: "50px" }}
                  priority
                />
              )}
            </Box>
          </Flex>
        </Box>

        <Separator size="4" />

        {/* Navigation */}
        <Box className="flex-1 mt-4 overflow-y-auto">
          <nav>
            <Flex direction="column" gap="1">
              {/* Home item - always at top */}
              {renderMenuItem(homeItem)}

              {/* Grouped sections */}
              {sections.map((section) => (
                <Box key={section.title} className="mt-3">
                  {!isCollapsed && (
                    <Text
                      size="1"
                      className="text-gray-400 uppercase tracking-wider font-semibold px-6 mb-1 block"
                    >
                      {section.title}
                    </Text>
                  )}
                  {isCollapsed && <Separator size="4" className="my-1" />}
                  <Flex direction="column" gap="0">
                    {section.items.map(renderMenuItem)}
                  </Flex>
                </Box>
              ))}
            </Flex>
          </nav>
        </Box>

        {/* Footer */}
        <Box
          className={`py-4 mt-auto border-t border-gray-200 ${isCollapsed ? "px-2" : "px-6"}`}
        >
          {!isCollapsed && (
            <Flex align="center" gap="2" className="mb-3">
              <Box className="text-gray-400">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 13C13.1046 13 14 12.1046 14 11C14 9.89543 13.1046 9 12 9C10.8954 9 10 9.89543 10 11C10 12.1046 10.8954 13 12 13Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M12 22C16 18 20 14.4183 20 11C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 11C4 14.4183 8 18 12 22Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </Box>
              <Text size="2" className="text-gray-500">
                Етрополе, Мирково
              </Text>
            </Flex>
          )}

          {/* Collapse toggle - desktop only */}
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex items-center justify-center w-full py-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={isCollapsed ? "Разшири менюто" : "Свий менюто"}
          >
            {isCollapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </button>
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
