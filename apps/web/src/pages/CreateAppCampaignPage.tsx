import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Alert, AlertDescription } from "../components/ui/alert";
import { api } from "../lib/api";
import { ArrowLeft, Rocket } from "lucide-react";

interface ValidatedApp {
  contractId: string;
  appName: string;
  appPartyId: string;
  metadata?: {
    name: string;
    description?: string;
  };
}

export default function CreateAppCampaignPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const navigate = useNavigate();

  const [app, setApp] = useState<ValidatedApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    campaignType: "STAKING" as "STAKING" | "FUNDING",
    goal: "",
    minBacking: "10",
    maxBacking: "1000",
    durationDays: "30",
  });

  useEffect(() => {
    loadApp();
  }, [contractId]);

  async function loadApp() {
    if (!contractId) return;
    setLoading(true);
    try {
      const res = await api.get<{ validatedApps: ValidatedApp[] }>(
        "/apps/validated"
      );
      const found = res.validatedApps.find((a) => a.contractId === contractId);
      if (found) {
        setApp(found);
      } else {
        setError("App not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractId || !app) return;

    setSubmitting(true);
    setError(null);

    try {
      const campaignId = `campaign-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + parseInt(formData.durationDays));

      await api.post(`/apps/validated/${contractId}/campaigns`, {
        campaignId,
        campaignType: formData.campaignType,
        goal: formData.goal,
        minBacking: formData.minBacking,
        maxBacking: formData.maxBacking,
        endsAt: endsAt.toISOString(),
      });

      navigate("/my-apps");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="container max-w-2xl py-8">
        <Alert variant="destructive">
          <AlertDescription>App not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate("/my-apps")}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to My Apps
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Create Campaign
          </CardTitle>
          <CardDescription>
            Launch a staking or funding campaign for {app.metadata?.name || app.appName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="campaignType">Campaign Type</Label>
              <Select
                value={formData.campaignType}
                onValueChange={(value: "STAKING" | "FUNDING") =>
                  setFormData({ ...formData, campaignType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAKING">
                    Staking - Backers lock CC for ongoing support
                  </SelectItem>
                  <SelectItem value="FUNDING">
                    Funding - One-time fundraising campaign
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal">Goal (Amulets)</Label>
              <Input
                id="goal"
                type="number"
                step="0.01"
                min="1"
                placeholder="e.g., 1000"
                value={formData.goal}
                onChange={(e) =>
                  setFormData({ ...formData, goal: e.target.value })
                }
                required
              />
              <p className="text-sm text-muted-foreground">
                Target amount to raise in Amulets
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minBacking">Min Backing (Amulets)</Label>
                <Input
                  id="minBacking"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.minBacking}
                  onChange={(e) =>
                    setFormData({ ...formData, minBacking: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxBacking">Max Backing (Amulets)</Label>
                <Input
                  id="maxBacking"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.maxBacking}
                  onChange={(e) =>
                    setFormData({ ...formData, maxBacking: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="durationDays">Duration (Days)</Label>
              <Select
                value={formData.durationDays}
                onValueChange={(value) =>
                  setFormData({ ...formData, durationDays: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Creating..." : "Create Campaign"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/my-apps")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
