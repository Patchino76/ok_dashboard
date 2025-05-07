'use client'

import { useState } from "react"
import { KpiCard } from "./KpiCard"
import { KpiDetailDialog } from "./KpiDetailDialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTagGroups } from "@/lib/tags"
import { TagDefinition, TagValue } from "@/lib/tags/types"
import { useDashboardTagGroup } from "@/hooks/useDashboardTagGroup"

export function KpiDashboard() {
  // State for the selected tag for the detail dialog
  const [selectedTag, setSelectedTag] = useState<{
    definition: TagDefinition;
    value: TagValue | null | undefined;
  } | null>(null)
  
  // Get all tag groups
  const groups = getTagGroups()
  
  return (
    <div className="space-y-6">
      <Tabs defaultValue={groups[0] || ""} className="w-full">
        <TabsList className="mb-4">
          {groups.map((group) => (
            <TabsTrigger key={group} value={group}>{group}</TabsTrigger>
          ))}
        </TabsList>
        
        {groups.map((group) => (
          <TabContent 
            key={group} 
            group={group} 
            onTagSelect={setSelectedTag} 
          />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
