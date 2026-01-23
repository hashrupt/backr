"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface PublishButtonProps {
  campaignId: string;
}

export function PublishButton({ campaignId }: PublishButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePublish = async () => {
    setLoading(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/publish`, {
        method: "POST",
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to publish:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" onClick={handlePublish} disabled={loading}>
      {loading ? "Publishing..." : "Publish"}
    </Button>
  );
}
