import { prisma } from "@/lib/db";
import { EntityCard } from "@/components/entities/EntityCard";

// Category colors for filter buttons
const categoryColors: Record<string, string> = {
  'DeFi': 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-100',
  'RWA': 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100',
  'Data': 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-900 dark:text-cyan-100',
  'Identity': 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100',
  'Gaming': 'bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900 dark:text-pink-100',
  'Other': 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100',
};

const categories = ['DeFi', 'RWA', 'Data', 'Identity', 'Gaming', 'Other'];

interface EntitiesPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
  }>;
}

async function getEntities(params: { page?: string; q?: string; category?: string }) {
  const page = parseInt(params.page || "1", 10);
  const limit = 12;

  // Only show Featured Apps
  const where: Record<string, unknown> = {
    type: "FEATURED_APP",
  };

  // Category filter
  if (params.category && params.category !== "all") {
    where.category = params.category;
  }

  // Search filter - search by name, description, or partyId
  if (params.q && params.q.trim()) {
    const searchTerm = params.q.trim();
    where.OR = [
      { name: { contains: searchTerm, mode: "insensitive" } },
      { description: { contains: searchTerm, mode: "insensitive" } },
      { partyId: { contains: searchTerm, mode: "insensitive" } },
    ];
  }

  const [entities, total] = await Promise.all([
    prisma.entity.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        partyId: true,
        description: true,
        logoUrl: true,
        website: true,
        externalId: true,
        category: true,
        claimStatus: true,
        activeStatus: true,
        owner: {
          select: { id: true, name: true },
        },
        _count: {
          select: { campaigns: true, backings: true },
        },
      },
    }),
    prisma.entity.count({ where }),
  ]);

  return { entities, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Helper to build URL with current filters
function buildUrl(params: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const merged = { ...params, ...overrides };
  const searchParams = new URLSearchParams();

  if (merged.category && merged.category !== "all") searchParams.set("category", merged.category);
  if (merged.q) searchParams.set("q", merged.q);
  if (merged.page && merged.page !== "1") searchParams.set("page", merged.page);

  const qs = searchParams.toString();
  return `/entities${qs ? `?${qs}` : ""}`;
}

export default async function EntitiesPage({ searchParams }: EntitiesPageProps) {
  const params = await searchParams;
  const { entities, total, page, totalPages } = await getEntities(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Featured Apps</h1>
        <p className="text-muted-foreground mt-1">
          Browse all {total} Featured Apps on Canton Network
        </p>
      </div>

      {/* Search */}
      <form method="GET" action="/entities" className="mb-6">
        {/* Preserve filters */}
        {params.category && params.category !== "all" && (
          <input type="hidden" name="category" value={params.category} />
        )}
        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            name="q"
            defaultValue={params.q || ""}
            placeholder="Search by name, description, or party ID..."
            className="flex-1 px-4 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Search
          </button>
          {params.q && (
            <a
              href={buildUrl(params, { q: undefined, page: undefined })}
              className="px-4 py-2 rounded-md bg-muted text-sm font-medium hover:bg-muted/80"
            >
              Clear
            </a>
          )}
        </div>
      </form>

      {/* Category Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="text-sm text-muted-foreground py-2 mr-2">Category:</span>
        <a
          href={buildUrl(params, { category: undefined, page: undefined })}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            !params.category || params.category === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          All
        </a>
        {categories.map((cat) => (
          <a
            key={cat}
            href={buildUrl(params, { category: cat, page: undefined })}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              params.category === cat
                ? "ring-2 ring-offset-2 ring-primary " + categoryColors[cat]
                : categoryColors[cat]
            }`}
          >
            {cat}
          </a>
        ))}
      </div>

      {/* Active filters summary */}
      {(params.category || params.q) && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filters:</span>
          {params.category && params.category !== "all" && (
            <span className={`px-2 py-1 rounded text-xs ${categoryColors[params.category] || 'bg-muted'}`}>
              {params.category}
            </span>
          )}
          {params.q && (
            <span className="px-2 py-1 bg-muted rounded text-xs">
              &quot;{params.q}&quot;
            </span>
          )}
          <a
            href="/entities"
            className="text-primary hover:underline text-xs ml-2"
          >
            Clear all
          </a>
        </div>
      )}

      {/* Entity Grid */}
      {entities.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No entities found</h3>
          <p className="text-muted-foreground mt-1">
            {params.q
              ? `No results for "${params.q}". Try a different search term.`
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
            <a
              href={buildUrl(params, { page: String(page - 1) })}
              className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium"
            >
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={buildUrl(params, { page: String(page + 1) })}
              className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm font-medium"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
