import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./stores/authStore";
import { Header } from "./components/layout/Header";
import { Footer } from "./components/layout/Footer";
import { SiteIndicator } from "./components/layout/SiteIndicator";

// Pages
import HomePage from "./pages/HomePage";
import EntitiesPage from "./pages/EntitiesPage";
import EntityDetailPage from "./pages/EntityDetailPage";
import CampaignsPage from "./pages/CampaignsPage";
import CampaignDetailPage from "./pages/CampaignDetailPage";
import ClaimEntityPage from "./pages/ClaimEntityPage";
import MyEntitiesPage from "./pages/MyEntitiesPage";
import MyEntityDetailPage from "./pages/MyEntityDetailPage";
import EditEntityPage from "./pages/EditEntityPage";
import NewCampaignPage from "./pages/NewCampaignPage";
import ManageCampaignPage from "./pages/ManageCampaignPage";
import MyInterestsPage from "./pages/MyInterestsPage";
import CompleteBackingPage from "./pages/CompleteBackingPage";
import MyBackingsPage from "./pages/MyBackingsPage";
import MyInvitesPage from "./pages/MyInvitesPage";
import MyAppsPage from "./pages/MyAppsPage";
import CreateAppCampaignPage from "./pages/CreateAppCampaignPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { authenticated, loading, login } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    login();
    return null;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <div className="antialiased min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/entities" element={<EntitiesPage />} />
          <Route path="/entities/:id" element={<EntityDetailPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/campaigns/:id" element={<CampaignDetailPage />} />

          {/* Protected routes */}
          <Route
            path="/claim-entity"
            element={
              <ProtectedRoute>
                <ClaimEntityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-entities"
            element={
              <ProtectedRoute>
                <MyEntitiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-entities/:id"
            element={
              <ProtectedRoute>
                <MyEntityDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-entities/:id/edit"
            element={
              <ProtectedRoute>
                <EditEntityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-entities/:id/campaigns/new"
            element={
              <ProtectedRoute>
                <NewCampaignPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-entities/:id/campaigns/:campaignId"
            element={
              <ProtectedRoute>
                <ManageCampaignPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-interests"
            element={
              <ProtectedRoute>
                <MyInterestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-interests/:id/complete"
            element={
              <ProtectedRoute>
                <CompleteBackingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-backings"
            element={
              <ProtectedRoute>
                <MyBackingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-invites"
            element={
              <ProtectedRoute>
                <MyInvitesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-apps"
            element={
              <ProtectedRoute>
                <MyAppsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-apps/:contractId/campaigns/new"
            element={
              <ProtectedRoute>
                <CreateAppCampaignPage />
              </ProtectedRoute>
            }
          />

          {/* Redirects for old auth routes */}
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <h1 className="text-4xl font-bold">404</h1>
                <p className="text-muted-foreground mt-2">Page not found</p>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
      <SiteIndicator />
    </div>
  );
}
