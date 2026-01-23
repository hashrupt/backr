"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";

interface Entity {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  logoUrl: string | null;
  partyId: string;
  type: string;
}

export default function EditEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [entityId, setEntityId] = useState<string | null>(null);
  const [entity, setEntity] = useState<Entity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Resolve params
  useEffect(() => {
    params.then((p) => setEntityId(p.id));
  }, [params]);

  // Fetch entity data
  useEffect(() => {
    if (!entityId) return;

    async function fetchEntity() {
      try {
        const response = await fetch(`/api/entities/${entityId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Entity not found");
          } else {
            setError("Failed to load entity");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setEntity(data.entity);
        setName(data.entity.name || "");
        setDescription(data.entity.description || "");
        setWebsite(data.entity.website || "");
        setLogoUrl(data.entity.logoUrl || "");
        setLoading(false);
      } catch {
        setError("Failed to load entity");
        setLoading(false);
      }
    }

    fetchEntity();
  }, [entityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const response = await fetch(`/api/entities/${entityId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          website: website.trim() || null,
          logoUrl: logoUrl.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to update entity");
        setSaving(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/my-entities/${entityId}`);
      }, 1500);
    } catch {
      setError("Failed to update entity");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="animate-pulse text-muted-foreground">
                Loading entity...
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !entity) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Alert variant="destructive">{error}</Alert>
        <Link href="/my-entities" className="mt-4 inline-block">
          <Button variant="outline">Back to My Entities</Button>
        </Link>
      </div>
    );
  }

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
          <CardTitle>Edit {entity?.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Update your entity profile information
          </p>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert variant="success" className="mb-6">
              Entity updated successfully! Redirecting...
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Entity name"
                required
                minLength={2}
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                The public name of your entity
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell backers about your entity..."
                rows={4}
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/2000 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
              />
              <p className="text-xs text-muted-foreground">
                Your entity&apos;s website URL
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                URL to your entity&apos;s logo image
              </p>
              {logoUrl && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="h-16 w-16 rounded-lg object-cover border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <div className="pt-4 border-t flex gap-3">
              <Button type="submit" disabled={saving || success}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Link href={`/my-entities/${entityId}`}>
                <Button type="button" variant="outline" disabled={saving}>
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
