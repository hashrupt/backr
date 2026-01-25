import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCC, InterestStatus, type EntityType } from "@backr/shared";

interface InterestCardProps {
  interest: {
    id: string;
    pledgeAmount: string;
    status: InterestStatus;
    message?: string | null;
    campaign: {
      id: string;
      title: string;
      entity: {
        id: string;
        name: string;
        type: EntityType;
        logoUrl?: string | null;
      };
    };
  };
  onWithdraw?: (id: string) => void;
}

const statusConfig: Record<
  InterestStatus,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  [InterestStatus.PENDING]: { label: "Pending Review", variant: "warning" },
  [InterestStatus.ACCEPTED]: { label: "Accepted", variant: "success" },
  [InterestStatus.DECLINED]: { label: "Declined", variant: "destructive" },
  [InterestStatus.WITHDRAWN]: { label: "Withdrawn", variant: "secondary" },
  [InterestStatus.CONVERTED]: { label: "Completed", variant: "success" },
};

export function InterestCard({ interest, onWithdraw }: InterestCardProps) {
  const config = statusConfig[interest.status];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {interest.campaign.entity.logoUrl ? (
              <img
                src={interest.campaign.entity.logoUrl}
                alt={interest.campaign.entity.name}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-lg font-semibold text-muted-foreground">
                  {interest.campaign.entity.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <Link
                to={`/campaigns/${interest.campaign.id}`}
                className="font-semibold hover:underline"
              >
                {interest.campaign.entity.name}
              </Link>
              <p className="text-sm text-muted-foreground">
                {interest.campaign.title}
              </p>
            </div>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Your pledge</p>
            <p className="text-lg font-semibold">
              {formatCC(interest.pledgeAmount)} CC
            </p>
          </div>

          <div className="flex gap-2">
            {interest.status === InterestStatus.PENDING && onWithdraw && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onWithdraw(interest.id)}
              >
                Withdraw
              </Button>
            )}
            {interest.status === InterestStatus.ACCEPTED && (
              <Link to={`/my-interests/${interest.id}/complete`}>
                <Button size="sm">Complete Pledge</Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
