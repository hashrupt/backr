import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCC } from "@/lib/constants";

interface BackersListProps {
  backings: {
    id: string;
    amount: string;
    status: string;
    user: {
      id: string;
      name: string | null;
    };
  }[];
  totalCount: number;
}

export function BackersList({ backings, totalCount }: BackersListProps) {
  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No backers yet. Be the first to back this campaign!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backers ({totalCount})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {backings.map((backing) => (
            <div
              key={backing.id}
              className="flex items-center justify-between py-2 border-b last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {backing.user.name?.charAt(0) || "?"}
                  </span>
                </div>
                <span className="font-medium">
                  {backing.user.name || "Anonymous"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {formatCC(backing.amount)} CC
                </span>
                <Badge
                  variant={backing.status === "LOCKED" ? "success" : "secondary"}
                  className="text-xs"
                >
                  {backing.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
        {totalCount > backings.length && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            And {totalCount - backings.length} more backers...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
