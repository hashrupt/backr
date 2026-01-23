"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NewCampaignPageProps {
  params: Promise<{ id: string }>;
}

export default function NewCampaignPage({ params }: NewCampaignPageProps) {
  const { id: entityId } = use(params);
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    targetAmount: "",
    minContribution: "",
    maxContribution: "",
    terms: "",
    endsAt: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent, publish = false) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Create the campaign
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityId,
          title: formData.title,
          description: formData.description || undefined,
          targetAmount: Number(formData.targetAmount),
          minContribution: formData.minContribution
            ? Number(formData.minContribution)
            : undefined,
          maxContribution: formData.maxContribution
            ? Number(formData.maxContribution)
            : undefined,
          terms: formData.terms || undefined,
          endsAt: formData.endsAt
            ? new Date(formData.endsAt).toISOString()
            : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create campaign");
        return;
      }

      // If publishing immediately, call the publish endpoint
      if (publish) {
        const publishResponse = await fetch(
          `/api/campaigns/${data.campaign.id}/publish`,
          { method: "POST" }
        );

        if (!publishResponse.ok) {
          // Campaign created but not published
          router.push(`/my-entities/${entityId}/campaigns/${data.campaign.id}`);
          return;
        }
      }

      router.push(`/my-entities/${entityId}/campaigns/${data.campaign.id}`);
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/my-entities/${entityId}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <svg
          className="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Entity
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Campaign Title *</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g., Series A Backing Round"
                value={formData.title}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe your campaign and what you're raising backing for..."
                value={formData.description}
                onChange={handleChange}
                rows={4}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAmount">Target Amount (CC) *</Label>
              <Input
                id="targetAmount"
                name="targetAmount"
                type="number"
                placeholder="e.g., 10000000"
                value={formData.targetAmount}
                onChange={handleChange}
                required
                min={1}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minContribution">Min Contribution (CC)</Label>
                <Input
                  id="minContribution"
                  name="minContribution"
                  type="number"
                  placeholder="Optional"
                  value={formData.minContribution}
                  onChange={handleChange}
                  min={1}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxContribution">Max Contribution (CC)</Label>
                <Input
                  id="maxContribution"
                  name="maxContribution"
                  type="number"
                  placeholder="Optional"
                  value={formData.maxContribution}
                  onChange={handleChange}
                  min={1}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endsAt">End Date</Label>
              <Input
                id="endsAt"
                name="endsAt"
                type="date"
                value={formData.endsAt}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Terms & Conditions</Label>
              <Textarea
                id="terms"
                name="terms"
                placeholder="Any specific terms or conditions for backers..."
                value={formData.terms}
                onChange={handleChange}
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                variant="outline"
                disabled={loading}
                className="flex-1"
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Creating..." : "Create & Publish"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
