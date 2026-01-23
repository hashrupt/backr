import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatCC } from "@/lib/constants";
import { EntityType, CampaignStatus } from "@/types";

interface CampaignCardProps {
  campaign: {
    id: string;
    title: string;
    description?: string | null;
    targetAmount: string | number;
    currentAmount: string | number;
    minContribution?: string | number | null;
    maxContribution?: string | number | null;
    endsAt?: string | Date | null;
    status: CampaignStatus;
    entity: {
      id: string;
      name: string;
      type: EntityType;
      logoUrl?: string | null;
      owner?: {
        id: string;
        name: string | null;
      } | null;
    };
    _count?: {
      backings: number;
    };
  };
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const target = Number(campaign.targetAmount);
  const current = Number(campaign.currentAmount);
  const percentage = target > 0 ? (current / target) * 100 : 0;

  const daysLeft = campaign.endsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(campaign.endsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {campaign.entity.logoUrl ? (
              <img
                src={campaign.entity.logoUrl}
                alt={campaign.entity.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-lg font-semibold text-muted-foreground">
                  {campaign.entity.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h3 className="font-semibold">{campaign.entity.name}</h3>
              <p className="text-sm text-muted-foreground">
                {campaign.entity.type === EntityType.FEATURED_APP
                  ? "Featured App"
                  : "Validator"}
              </p>
            </div>
          </div>
          <Badge
            variant={
              campaign.status === CampaignStatus.OPEN ? "success" : "secondary"
            }
          >
            {campaign.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium">{campaign.title}</h4>
          {campaign.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {campaign.description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Progress value={current} max={target} />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatCC(current)} / {formatCC(target)} CC
            </span>
            <span className="font-medium">{percentage.toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {campaign.minContribution && (
            <span>Min: {formatCC(campaign.minContribution)} CC</span>
          )}
          {campaign.maxContribution && (
            <span>Max: {formatCC(campaign.maxContribution)} CC</span>
          )}
          {campaign._count && <span>{campaign._count.backings} backers</span>}
          {daysLeft !== null && (
            <span>
              {daysLeft > 0 ? `${daysLeft} days left` : "Ended"}
            </span>
          )}
        </div>

        <Link href={`/campaigns/${campaign.id}`}>
          <Button variant="outline" className="w-full">
            View Campaign
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
