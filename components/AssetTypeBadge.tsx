// src/components/AssetTypeBadge.tsx
import { Badge } from '@/components/ui/badge'
import { SiteAssetType } from '@prisma/client'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface AssetTypeBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  type: SiteAssetType
}

export function AssetTypeBadge({ type, ...props }: AssetTypeBadgeProps) {
  const typeMap: Partial<Record<SiteAssetType, { label: string; variant: BadgeVariant }>> = {
    social_site: { label: 'Social Site', variant: 'default' },
    web2_site: { label: 'Web 2.0', variant: 'secondary' },
    other_asset: { label: 'Other', variant: 'outline' },
  }

  const meta = typeMap[type] ?? { label: type.replace(/_/g, ' '), variant: 'outline' as BadgeVariant }

  return (
    <Badge variant={meta.variant} {...props}>
      {meta.label}
    </Badge>
  )
}
