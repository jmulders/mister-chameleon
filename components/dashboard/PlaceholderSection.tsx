import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/primitives/Text";

/**
 * PlaceholderSection
 *
 * Shared layout shell for dashboard sections that are planned but not yet
 * implemented. Renders a consistent page header + "coming soon" card.
 */

interface PlaceholderSectionProps {
  title: string;
  description: string;
  /** Rough description of what will be built here. */
  roadmapNote?: string;
}

export function PlaceholderSection({
  title,
  description,
  roadmapNote,
}: PlaceholderSectionProps) {
  return (
    <div className="flex flex-col gap-8 px-8 py-8">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <Text variant="h2" as="h1">
            {title}
          </Text>
          <Badge variant="outline" size="sm">
            Planned
          </Badge>
        </div>
        <Text variant="body-sm" color="muted">
          {description}
        </Text>
      </div>

      {/* Placeholder card */}
      <Card padding="lg" shadow="none" className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="text-3xl" aria-hidden>
            🚧
          </span>
          <Text variant="h4" as="p">
            Not yet built
          </Text>
          <Text variant="body-sm" color="muted" className="max-w-sm">
            {roadmapNote ??
              "This section is reserved for a future phase of development. Check back as the platform evolves."}
          </Text>
        </CardContent>
      </Card>
    </div>
  );
}
