"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

function FiltersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/campaigns?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <Input
          type="search"
          placeholder="Search campaigns..."
          defaultValue={searchParams.get("search") || ""}
          onChange={(e) => {
            const value = e.target.value;
            // Debounce search
            const timer = setTimeout(() => updateParams("search", value), 300);
            return () => clearTimeout(timer);
          }}
        />
      </div>
      <Select
        defaultValue={searchParams.get("type") || "all"}
        onChange={(e) => updateParams("type", e.target.value)}
        className="w-full sm:w-48"
      >
        <option value="all">All Types</option>
        <option value="FEATURED_APP">Featured Apps</option>
        <option value="VALIDATOR">Validators</option>
      </Select>
      <Select
        defaultValue={searchParams.get("sort") || "newest"}
        onChange={(e) => updateParams("sort", e.target.value)}
        className="w-full sm:w-48"
      >
        <option value="newest">Newest First</option>
        <option value="ending">Ending Soon</option>
        <option value="funded">Most Funded</option>
      </Select>
    </div>
  );
}

export function CampaignFilters() {
  return (
    <Suspense fallback={<div className="h-10 bg-muted animate-pulse rounded" />}>
      <FiltersContent />
    </Suspense>
  );
}
