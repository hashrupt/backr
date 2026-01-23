"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface InviteResponseProps {
  inviteId: string;
}

export function InviteResponse({ inviteId }: InviteResponseProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  const handleRespond = async (status: "ACCEPTED" | "DECLINED") => {
    setProcessing(true);

    try {
      const response = await fetch(`/api/invites/${inviteId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to respond to invite:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex gap-2 pt-2">
      <Button
        size="sm"
        onClick={() => handleRespond("ACCEPTED")}
        disabled={processing}
      >
        Accept
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleRespond("DECLINED")}
        disabled={processing}
      >
        Decline
      </Button>
    </div>
  );
}
