'use client'

import { useState, useEffect, useRef, useMemo } from "react"
import { 
  ChevronLeft, 
  ChevronRight, 
  Factory, 
  Cog, 
  Warehouse, 
  Truck, 
  Gauge, 
  Droplets, 
  CircuitBoard, 
  Forklift,
  Box,
  Wrench,
  Scale,
  Waves,
  MoveHorizontal, // Horizontal movement like a conveyor belt
  ArrowLeftRight,  // Another good option for conveyor movement
  BarChart3, // Level measurement for bunkers
  Database, // Alternative for level measurement
  Layers, // Another option for level measurement
  RotateCw, // Representing rotation for ball mill
  Circle, // Alternative for ball mill
  RotateCcw, // Another option for ball mill
  Hammer, // For press - hammering/impact
  Download, // For press - downward pressure
  ArrowDown, // For press - downward direction
  Scissors // For press - cutting/pressing action
} from "lucide-react"
import { KpiCard } from "./KpiCard"
import { KpiDetailDialog } from "./KpiDetailDialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTagGroups } from "@/lib/tags"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { useDashboardTags } from "@/hooks/useDashboardTags"
import { getColorFromGroup } from "@/lib/utils"
import { dashboardTags } from "@/lib/tags/dashboard-tags"

export function KpiDashboard() {
  // State for the selected tag for the detail dialog
  const [selectedTag, setSelectedTag] = useState<{
    definition: TagDefinition;
    value: TagValue | null | undefined;
  } | null>(null)
  
  // Define all the groups we want to show, in the exact order from the image
  const groups = useMemo(() => {
    // Hard-code the exact groups in their display order to avoid encoding issues
    // The list is placed in the exact order we want the tabs to appear
    return [
      // Make sure КЕТ1 is the first one
      "КЕТ1", "КЕТ3", "КЕТ", "МГТЛ", "ССТ", "Поток 1-4", "Поток 5-13", "Поток 15", "Поток 16", 
      "Бункери", "Мелнично", "Флотация", "Преса", "Авт. веза", "ВХС"
    ];
  }, []);
  
  // Create a mapping between groups and their icons
  const groupIcons: Record<string, React.ReactNode> = useMemo(() => ({
    "КЕТ1": <Factory size={16} />,
    "КЕТ3": <Factory size={16} />,
    "КЕТ": <Factory size={16} />,
    // Use ArrowLeftRight icon for all flow groups and МГТЛ
    "МГТЛ": <ArrowLeftRight size={16} />,
    "ССТ": <Cog size={16} />,
    "Поток 1-4": <ArrowLeftRight size={16} />,
    "Поток 5-13": <ArrowLeftRight size={16} />,
    "Поток 15": <ArrowLeftRight size={16} />,
    "Поток 16": <ArrowLeftRight size={16} />,
    "Бункери": <Layers size={16} />,
    "Мелнично": <RotateCw size={16} />,
    "Флотация": <CircuitBoard size={16} />,
    "Преса": <Hammer size={16} />,
    "Авт. веза": <Truck size={16} />,
    "ВХС": <Waves size={16} />
  }), []);
  
  const [activeGroup, setActiveGroup] = useState<string>(groups[0] || "")
  const tabsListRef = useRef<HTMLDivElement>(null)
  const [showControls, setShowControls] = useState(false)

  // Handle scroll on tab navigation
  const handleScroll = (direction: 'left' | 'right') => {
    if (tabsListRef.current) {
      const container = tabsListRef.current
      const scrollAmount = direction === 'left' ? -150 : 150
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  // Check if scroll arrows should be shown
  useEffect(() => {
    const checkScrollability = () => {
      if (tabsListRef.current) {
        const { scrollWidth, clientWidth } = tabsListRef.current
        setShowControls(scrollWidth > clientWidth)
      }
    }

    checkScrollability()
    window.addEventListener('resize', checkScrollability)
    return () => window.removeEventListener('resize', checkScrollability)
  }, [])

  // Handle tab or dropdown change
  const handleGroupChange = (value: string) => {
    setActiveGroup(value)
  }
  
  return (
    <div className="space-y-6">
      {/* Custom tab interface that doesn't use shadcn Tabs component */}
      <div className="w-full">
        {/* Mobile dropdown selector - shown only on small screens */}
        <div className="block sm:hidden mb-4">
          <select 
            value={activeGroup}
            onChange={(e) => setActiveGroup(e.target.value)}
            className="w-full p-3 border rounded bg-background text-foreground text-sm"
          >
            {groups.map((group) => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        {/* Tab navigation - hidden on mobile, shown on larger screens */}
        <div className="hidden sm:block relative mb-4">
          {/* Left/right scroll controls */}
          {showControls && (
            <>
              <button 
                onClick={() => handleScroll('left')} 
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-gray-50 rounded-full p-1 shadow-sm"
                aria-label="Scroll left"
              >
                <ChevronLeft size={14} className="text-blue-500" />
              </button>
              <button 
                onClick={() => handleScroll('right')} 
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-gray-50 rounded-full p-1 shadow-sm"
                aria-label="Scroll right"
              >
                <ChevronRight size={14} className="text-blue-500" />
              </button>
            </>
          )}
          
          {/* Custom tab navigation with increased height and horizontal mouse scrolling */}
          <div className="overflow-hidden bg-white shadow-sm rounded-none border-b border-slate-200">
            <div 
              ref={tabsListRef}
              className="flex overflow-x-auto w-full py-1 whitespace-nowrap"
              style={{ 
                scrollbarWidth: 'none',  /* Firefox */
                msOverflowStyle: 'none',  /* IE and Edge */
                overflowY: 'hidden'
              }}
              onWheel={(e) => {
                // Enable horizontal scrolling with the mouse wheel
                if (tabsListRef.current) {
                  e.preventDefault();
                  tabsListRef.current.scrollLeft += e.deltaY;
                }
              }}
            >
              {groups.map((group) => (
                <button
                  key={group}
                  onClick={() => setActiveGroup(group)}
                  className={`
                    flex-shrink-0 relative py-3 px-5 text-sm font-medium transition-all
                    flex items-center gap-2
                    ${activeGroup === group 
                      ? 'text-blue-500 border-b-4 border-blue-500' 
                      : 'text-slate-600 border-b-4 border-transparent'}
                  `}
                >
                  <span className="opacity-80">{groupIcons[group] || <Cog size={16} />}</span>
                  {group}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Custom tab content panels */}
        <div className="mt-4">
          {groups.map((group) => (
            <div 
              key={group} 
              className={`${activeGroup === group ? 'block' : 'hidden'}`}
            >
              <TabContent 
                group={group} 
                onTagSelect={setSelectedTag} 
              />
            </div>
          ))}
        </div>
      </div>
      
      {/* Detail Dialog */}
      <KpiDetailDialog 
        definition={selectedTag?.definition || null}
        value={selectedTag?.value}
        open={selectedTag !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTag(null)
        }}
        color={selectedTag?.definition ? getColorFromGroup(selectedTag.definition.group) : undefined}
      />
    </div>
  )
}

// Component to render content for each tab
function TabContent({ 
  group, 
  onTagSelect 
}: { 
  group: string; 
  onTagSelect: (tag: { definition: TagDefinition; value: TagValue | null | undefined }) => void;
}) {
  // Get all the tag definitions for this group (filtering out boolean state tags)
  const groupTags = useMemo(() => 
    dashboardTags.filter(tag => tag.group === group && tag.unit !== 'bool'),
    [group]
  );
  
  // Get the tag names to fetch
  const tagNames = useMemo(() => 
    groupTags.map(tag => tag.name),
    [groupTags]
  );
  
  // Fetch tag values using the simplified hook
  const { data, loading } = useDashboardTags(tagNames);
  
  if (loading) {
    return <div className="text-center py-8">Loading {group} metrics...</div>
  }
  
  // Combine definitions with their values
  const tags = groupTags.map(definition => ({
    definition,
    value: data[definition.name]
  }));
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {tags.map(({ definition, value }) => (
        <KpiCard
          key={definition.id}
          definition={definition}
          value={value}
          onClick={() => onTagSelect({ definition, value })}
        />
      ))}
    </div>
  )
}
