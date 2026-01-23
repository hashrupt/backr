import { prisma } from "@/lib/db";
import { EntityCard } from "@/components/entities/EntityCard";

// Use string literal type to avoid Prisma import issues
type EntityType = "FEATURED_APP" | "VALIDATOR";

interface EntitiesPageProps {
  searchParams: Promise<{
    type?: string;
    page?: string;
    q?: string;
  }>;
}

async function getEntities(params: { type?: string; page?: string; q?: string }) {
  const page = parseInt(params.page || "1", 10);
  const limit = 12;

  const where: Record<string, unknown> = {};

  if (params.type && params.type !== "all") {
    where.type = params.type as EntityType;
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

export default async function EntitiesPage({ searchParams }: EntitiesPageProps) {
  const params = await searchParams;
  const { entities, total, page, totalPages } = await getEntities(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Featured Apps & Validators</h1>
        <p className="text-muted-foreground mt-1">
          Browse all {total} registered entities on Canton Network
        </p>
      </div>

      {/* Search */}
      <form method="GET" action="/entities" className="mb-6">
        {/* Preserve type filter */}
        {params.type && params.type !== "all" && (
          <input type="hidden" name="type" value={params.type} />
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
              href={`/entities${params.type ? `?type=${params.type}` : ""}`}
              className="px-4 py-2 rounded-md bg-muted text-sm font-medium hover:bg-muted/80"
            >
              Clear
            </a>
          )}
        </div>
      </form>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <a
          href={`/entities${params.q ? `?q=${encodeURIComponent(params.q)}` : ""}`}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            !params.type || params.type === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          All
        </a>
        <a
          href={`/entities?type=FEATURED_APP${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            params.type === "FEATURED_APP"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Featured Apps
        </a>
        <a
          href={`/entities?type=VALIDATOR${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            params.type === "VALIDATOR"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          Validators
        </a>
      </div>

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
              href={`/entities?page=${page - 1}${params.type ? `&type=${params.type}` : ""}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
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
              href={`/entities?page=${page + 1}${params.type ? `&type=${params.type}` : ""}${params.q ? `&q=${encodeURIComponent(params.q)}` : ""}`}
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
