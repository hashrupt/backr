import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { InterestCard } from "@/components/interests/InterestCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import api, { ApiError } from "@/lib/api";
import { formatCC, type InterestStatus, type EntityType } from "@backr/shared";

interface Interest {
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
}

export default function MyInterestsPage() {
  const { user } = useAuth();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchInterests = useCallback(async () => {
    try {
      const data = await api.get<{ interests: Interest[] }>("/interests");
      setInterests(data.interests || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load interests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  const handleWithdraw = async (id: string) => {
    try {
      await api.patch(`/interests/${id}/withdraw`);
      await fetchInterests();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to withdraw interest");
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Interests</h1>
        <p className="text-muted-foreground mt-1">
          Track your backing interest submissions
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : interests.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No interests yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            Browse open campaigns to express your backing interest
          </p>
          <Link to="/campaigns">
            <Button>Browse Campaigns</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {interests.map((interest) => (
            <InterestCard
              key={interest.id}
              interest={interest}
              onWithdraw={handleWithdraw}
            />
          ))}
        </div>
      )}
    </div>
  );
}
