import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, AlertDescription } from "../components/ui/alert";
import { api } from "../lib/api";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  ExternalLink,
  Coins,
} from "lucide-react";

interface FeeRequest {
  contractId: string;
  appName: string;
  appPartyId: string;
  feeAmount: string;
  prepareUntil: string;
  settleBefore: string;
  createdAt: string;
}

interface AllocationRequest {
  contractId: string;
  appName: string;
  appPartyId: string;
  feeAmount: string;
  allocationId: string;
  status: string;
  prepareUntil: string;
}

interface ValidatedApp {
  contractId: string;
  appName: string;
  appPartyId: string;
  validatedAt: string;
  isActive: boolean;
  metadata?: {
    name: string;
    description?: string;
    website?: string;
    category: string;
  };
}

export default function MyAppsPage() {
  const [feeRequests, setFeeRequests] = useState<FeeRequest[]>([]);
  const [allocationRequests, setAllocationRequests] = useState<AllocationRequest[]>([]);
  const [validatedApps, setValidatedApps] = useState<ValidatedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [feeRes, allocRes, validRes] = await Promise.all([
        api.get<{ feeRequests: FeeRequest[] }>("/apps/fee-requests"),
        api.get<{ allocationRequests: AllocationRequest[] }>("/apps/allocation-requests"),
        api.get<{ validatedApps: ValidatedApp[] }>("/apps/validated"),
      ]);
      setFeeRequests(feeRes.feeRequests || []);
      setAllocationRequests(allocRes.allocationRequests || []);
      setValidatedApps(validRes.validatedApps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptFeeRequest(contractId: string) {
    setProcessingId(contractId);
    try {
      const allocationId = `alloc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await api.post(`/apps/fee-requests/${contractId}/accept`, {
        allocationId,
        holdingContractId: "pending", // Will be set during allocation
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept fee request");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRejectFeeRequest(contractId: string) {
    setProcessingId(contractId);
    try {
      await api.post(`/apps/fee-requests/${contractId}/reject`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject fee request");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleAllocateFunds(contractId: string) {
    setProcessingId(contractId);
    try {
      // In a real implementation, this would open a wallet connect dialog
      // For now, we simulate with a placeholder holding CID
      await api.post(`/apps/allocation-requests/${contractId}/allocate`, {
        holdingCid: "placeholder-holding-cid",
      });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate funds");
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Apps</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Featured Apps and campaigns
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Pending Fee Requests */}
      {feeRequests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Pending Fee Requests
          </h2>
          <div className="space-y-4">
            {feeRequests.map((req) => (
              <Card key={req.contractId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{req.appName}</CardTitle>
                    <Badge variant="outline" className="text-yellow-600">
                      Fee Required
                    </Badge>
                  </div>
                  <CardDescription>
                    Pay {req.feeAmount} Amulets to validate your app
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    <p>Party ID: {req.appPartyId}</p>
                    <p>
                      Deadline:{" "}
                      {new Date(req.prepareUntil).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAcceptFeeRequest(req.contractId)}
                      disabled={processingId === req.contractId}
                    >
                      <Coins className="h-4 w-4 mr-2" />
                      {processingId === req.contractId
                        ? "Processing..."
                        : "Accept & Pay Fee"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRejectFeeRequest(req.contractId)}
                      disabled={processingId === req.contractId}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Pending Allocations */}
      {allocationRequests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Coins className="h-5 w-5 text-blue-500" />
            Pending Fund Allocations
          </h2>
          <div className="space-y-4">
            {allocationRequests.map((req) => (
              <Card key={req.contractId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{req.appName}</CardTitle>
                    <Badge variant="outline" className="text-blue-600">
                      Allocation Pending
                    </Badge>
                  </div>
                  <CardDescription>
                    Allocate {req.feeAmount} Amulets to complete validation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    <p>Allocation ID: {req.allocationId}</p>
                    <p>
                      Deadline:{" "}
                      {new Date(req.prepareUntil).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleAllocateFunds(req.contractId)}
                    disabled={processingId === req.contractId}
                  >
                    <Coins className="h-4 w-4 mr-2" />
                    {processingId === req.contractId
                      ? "Allocating..."
                      : "Allocate Funds"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Validated Apps */}
      <section>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Validated Apps
        </h2>
        {validatedApps.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No validated apps yet.</p>
              <p className="text-sm mt-1">
                Complete the fee payment process to validate your app.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {validatedApps.map((app) => (
              <Card key={app.contractId}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {app.metadata?.name || app.appName}
                    </CardTitle>
                    <Badge
                      variant={app.isActive ? "default" : "secondary"}
                      className={app.isActive ? "bg-green-600" : ""}
                    >
                      {app.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {app.metadata?.description || `Party: ${app.appPartyId}`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-4">
                    <p>
                      Validated:{" "}
                      {new Date(app.validatedAt).toLocaleDateString()}
                    </p>
                    {app.metadata?.category && (
                      <p>Category: {app.metadata.category}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild>
                      <Link to={`/my-apps/${app.contractId}/campaigns/new`}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Campaign
                      </Link>
                    </Button>
                    {app.metadata?.website && (
                      <Button variant="outline" asChild>
                        <a
                          href={app.metadata.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Website
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Empty state when no data */}
      {feeRequests.length === 0 &&
        allocationRequests.length === 0 &&
        validatedApps.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Apps Found</h3>
              <p className="text-muted-foreground mb-4">
                You don't have any apps registered yet. Contact the platform
                operator to get started with app validation.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
