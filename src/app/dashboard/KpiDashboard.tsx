'use client'

import { useState, useEffect, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { KpiCard } from "./KpiCard"
import { KpiDetailDialog } from "./KpiDetailDialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTagGroups } from "@/lib/tags"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { useDashboardTagGroup } from "@/hooks/useDashboardTagGroup"
import { getColorFromGroup } from "@/lib/utils"

export function KpiDashboard() {
  // State for the selected tag for the detail dialog
  const [selectedTag, setSelectedTag] = useState<{
    definition: TagDefinition;
    value: TagValue | null | undefined;
  } | null>(null)
  
  // Get all tag groups
  const groups = getTagGroups()
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
      {/* Unified UI for both mobile and desktop */}
      <Tabs value={activeGroup} onValueChange={handleGroupChange} className="w-full">
        {/* Mobile dropdown selector - shown only on small screens */}
        <div className="block sm:hidden mb-4">
          <select 
            value={activeGroup}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="w-full p-2 border rounded bg-background text-foreground"
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
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background rounded-full p-1 shadow-md"
                aria-label="Scroll left"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => handleScroll('right')} 
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background rounded-full p-1 shadow-md"
                aria-label="Scroll right"
              >
                <ChevronRight size={16} />
              </button>
            </>
          )}
          
          {/* Scrollable tab list */}
          <div className="overflow-hidden px-6">
            <TabsList 
              ref={tabsListRef}
              className="flex overflow-x-auto pb-2 scrollbar-none w-full"
            >
              {groups.map((group) => (
                <TabsTrigger 
                  key={group} 
                  value={group} 
                  className="flex-shrink-0 whitespace-nowrap text-sm py-1.5 px-3"
                >
                  {group}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>
        
        {/* Tab content - shared between mobile and desktop */}
        {groups.map((group) => (
          <TabsContent key={group} value={group} className="mt-0">
            <TabContent 
              group={group} 
              onTagSelect={setSelectedTag} 
            />
          </TabsContent>
        ))}
      </Tabs>
      
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
  // Fetch tags for this group
  const { tags, loading } = useDashboardTagGroup(group)
  
  if (loading) {
    return (
      <TabsContent value={group} className="mt-0">
        <div className="text-center py-8">Loading {group} metrics...</div>
      </TabsContent>
    )
  }
  
  return (
    <TabsContent value={group} className="mt-0">
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
    </TabsContent>
  )
}
