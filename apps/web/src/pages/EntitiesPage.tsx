import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { EntityCard } from "@/components/entities/EntityCard";
import api from "@/lib/api";

const categoryColors: Record<string, string> = {
  'DeFi': 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100',
  'RWA': 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100',
  'Data': 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-900 dark:text-cyan-100',
  'Identity': 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100',
  'Gaming': 'bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-100',
  'Other': 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100',
};

const categories = ['DeFi', 'RWA', 'Data', 'Identity', 'Gaming', 'Other'];

interface Entity {
  id: string;
  name: string;
  type: string;
  partyId: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  externalId?: string | null;
  category?: string | null;
  claimStatus: "UNCLAIMED" | "PENDING_CLAIM" | "CLAIMED" | "SELF_REGISTERED";
  activeStatus: string;
  owner?: { id: string; name: string | null } | null;
  _count?: { campaigns: number; backings: number };
}

export default function EntitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");

  const page = parseInt(searchParams.get("page") || "1", 10);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (category) params.set("category", category);
    if (q) params.set("q", q);

    api
      .get<{ entities: Entity[]; total: number }>(`/entities?${params.toString()}`)
      .then((data) => {
        setEntities(data.entities);
        setTotal(data.total);
      })
      .catch(() => {
        setEntities([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, category, q]);

  const totalPages = Math.ceil(total / 12);

  const updateParams = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    // Reset page when changing filters
    if ("category" in overrides || "q" in overrides) {
      params.delete("page");
    }
    setSearchParams(params);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ q: searchInput || null });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Featured Apps</h1>
        <p className="text-muted-foreground mt-1">
          Browse all {total} Featured Apps on Canton Network
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, description, or party ID..."
            className="flex-1 px-4 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Search
          </button>
          {q && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                updateParams({ q: null });
              }}
              className="px-4 py-2 rounded-md bg-muted text-sm font-medium hover:bg-muted/80"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Category Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground py-2 mr-2">Category:</span>
        <button
          onClick={() => updateParams({ category: null })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !category
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => updateParams({ category: cat })}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === cat
                ? "ring-2 ring-offset-2 ring-primary " + categoryColors[cat]
                : categoryColors[cat]
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Active filters summary */}
      {(category || q) && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filters:</span>
          {category && (
            <span className={`px-2 py-1 rounded text-xs ${categoryColors[category] || 'bg-muted'}`}>
              {category}
            </span>
          )}
          {q && (
            <span className="px-2 py-1 bg-muted rounded text-xs">
              &quot;{q}&quot;
            </span>
          )}
          <button
            onClick={() => setSearchParams({})}
            className="text-primary hover:underline text-xs ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Entity Grid */}
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No entities found</h3>
          <p className="text-muted-foreground mt-1">
            {q
              ? `No results for "${q}". Try a different search term.`
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => (
            <EntityCard key={entity.id} entity={entity} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          {page > 1 && (
            <button
              onClick={() => updateParams({ page: String(page - 1) })}
              className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium"
            >
              Previous
            </button>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <button
              onClick={() => updateParams({ page: String(page + 1) })}
              className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium"
            >
              Next
            </button>
          )}
        </div>
      )}
    </div>
  );
}
