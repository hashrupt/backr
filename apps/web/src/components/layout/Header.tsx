import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";

export function Header() {
  const { authenticated, user, loading, login, logout, register } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="border-b bg-background">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold">
              Backr
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            <Link
              to="/entities"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Featured Apps
            </Link>
            <Link
              to="/campaigns"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Campaigns
            </Link>
            <Link
              to="/claim-entity"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Claim Entity
            </Link>
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-muted" />
            ) : authenticated ? (
              <div className="flex items-center space-x-4">
                <div className="relative group">
                  <button className="flex items-center space-x-2 text-sm font-medium">
                    <span>{user?.name || user?.email}</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-background shadow-lg ring-1 ring-black ring-opacity-5 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="py-1">
                      <Link
                        to="/my-entities"
                        className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                      >
                        My Entities
                      </Link>
                      <Link
                        to="/my-interests"
                        className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                      >
                        My Interests
                      </Link>
                      <Link
                        to="/my-invites"
                        className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                      >
                        My Invites
                      </Link>
                      <Link
                        to="/my-backings"
                        className="block px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
                      >
                        My Backings
                      </Link>
                      <hr className="my-1" />
                      <button
                        onClick={() => logout()}
                        className="block w-full px-4 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={login}>
                  Sign In
                </Button>
                <Button size="sm" onClick={register}>
                  Sign Up
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4">
            <div className="space-y-1 pt-2">
              <Link
                to="/entities"
                className="block px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
              >
                Featured Apps
              </Link>
              <Link
                to="/campaigns"
                className="block px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
              >
                Campaigns
              </Link>
              <Link
                to="/claim-entity"
                className="block px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
              >
                Claim Entity
              </Link>
              {authenticated ? (
                <>
                  <Link
                    to="/my-entities"
                    className="block px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
                  >
                    My Entities
                  </Link>
                  <Link
                    to="/my-interests"
                    className="block px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
                  >
                    My Interests
                  </Link>
                  <button
                    onClick={() => logout()}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={login}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={register}
                    className="block w-full text-left px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
