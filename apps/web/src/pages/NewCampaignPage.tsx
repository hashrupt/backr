import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api, { ApiError } from "@/lib/api";
import { formatCC, parseCC } from "@backr/shared";

interface CampaignForm {
  title: string;
  description: string;
  targetAmount: string;
  minContribution: string;
  maxContribution: string;
  endsAt: string;
  terms: string;
}

interface CampaignResponse {
  campaign: { id: string };
}

export default function NewCampaignPage() {
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState<CampaignForm>({
    title: "",
    description: "",
    targetAmount: "",
    minContribution: "",
    maxContribution: "",
    endsAt: "",
    terms: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const updateField = (field: keyof CampaignForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      entityId,
      title: form.title,
    };
    if (form.description) payload.description = form.description;
    if (form.targetAmount) payload.targetAmount = parseCC(Number(form.targetAmount)).toString();
    if (form.minContribution) payload.minContribution = parseCC(Number(form.minContribution)).toString();
    if (form.maxContribution) payload.maxContribution = parseCC(Number(form.maxContribution)).toString();
    if (form.endsAt) payload.endsAt = new Date(form.endsAt).toISOString();
    if (form.terms) payload.terms = form.terms;
    return payload;
  };

  const handleSaveDraft = async () => {
    if (!form.title.trim() || !form.targetAmount) return;
    setSubmitting(true);
    setError("");

    try {
      const data = await api.post<CampaignResponse>("/campaigns", buildPayload());
      navigate(`/campaigns/${data.campaign.id}/manage`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndPublish = async () => {
    if (!form.title.trim() || !form.targetAmount) return;
    setSubmitting(true);
    setError("");

    try {
      const data = await api.post<CampaignResponse>("/campaigns", buildPayload());
      await api.post(`/campaigns/${data.campaign.id}/publish`);
      navigate(`/campaigns/${data.campaign.id}/manage`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to={`/entities/${entityId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to Entity
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create New Campaign</h1>
        <p className="text-muted-foreground mt-1">
          Set up a backing campaign for your entity
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g. Series A Backing Round"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your campaign and what backers can expect..."
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={4}
              />
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="targetAmount">Target Amount (CC) *</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  placeholder="e.g. 10000000"
                  value={form.targetAmount}
                  onChange={(e) => updateField("targetAmount", e.target.value)}
                  min={0}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="minContribution">Min Contribution (CC)</Label>
                <Input
                  id="minContribution"
                  type="number"
                  placeholder="e.g. 1000"
                  value={form.minContribution}
                  onChange={(e) => updateField("minContribution", e.target.value)}
                  min={0}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxContribution">Max Contribution (CC)</Label>
                <Input
                  id="maxContribution"
                  type="number"
                  placeholder="e.g. 5000000"
                  value={form.maxContribution}
                  onChange={(e) => updateField("maxContribution", e.target.value)}
                  min={0}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endsAt">End Date</Label>
              <Input
                id="endsAt"
                type="date"
                value={form.endsAt}
                onChange={(e) => updateField("endsAt", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Terms &amp; Conditions</Label>
              <Textarea
                id="terms"
                placeholder="Any terms or conditions for backers..."
                value={form.terms}
                onChange={(e) => updateField("terms", e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={submitting || !form.title.trim() || !form.targetAmount}
              >
                {submitting ? "Saving..." : "Save as Draft"}
              </Button>
              <Button
                onClick={handleCreateAndPublish}
                disabled={submitting || !form.title.trim() || !form.targetAmount}
              >
                {submitting ? "Publishing..." : "Create & Publish"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
