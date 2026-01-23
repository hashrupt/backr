"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCC } from "@/lib/constants";

interface CompleteBackingFormProps {
  interestId: string;
  campaignId: string;
  entityId: string;
  amount: number;
}

export function CompleteBackingForm({
  interestId,
  campaignId,
  entityId,
  amount,
}: CompleteBackingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/backings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestId,
          campaignId,
          entityId,
          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to complete backing");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Alert variant="success">
        <AlertDescription>
          Congratulations! You are now backing this entity with{" "}
          {formatCC(amount)} CC. Your CC has been locked and you can track your
          backing in{" "}
          <a href="/my-backings" className="font-medium underline">
            My Backings
          </a>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4">
        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1"
        >
          {loading ? "Processing..." : `Lock ${formatCC(amount)} CC`}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/my-interests")}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
