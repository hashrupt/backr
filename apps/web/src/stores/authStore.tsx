import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import keycloak, {
  initKeycloak,
  startTokenRefresh,
  stopTokenRefresh,
  getAccessToken as getKeycloakToken,
  getPartyId,
} from "../lib/keycloak";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  preferredUsername?: string;
  partyId?: string; // Canton party ID (same as sub)
}

interface AuthContextValue {
  authenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  token: string | undefined;
  login: () => void;
  logout: () => void;
  register: () => void;
  getAccessToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue>({
  authenticated: false,
  user: null,
  loading: true,
  token: undefined,
  login: () => {},
  logout: () => {},
  register: () => {},
  getAccessToken: async () => "",
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    initKeycloak()
      .then((auth) => {
        setAuthenticated(auth);
        if (auth && keycloak.tokenParsed) {
          setUser({
            id: keycloak.tokenParsed.sub!,
            email: keycloak.tokenParsed.email as string,
            name: keycloak.tokenParsed.name as string,
            preferredUsername: keycloak.tokenParsed.preferred_username as string,
            partyId: getPartyId(),
          });
          setToken(keycloak.token);
          // Start automatic token refresh
          startTokenRefresh();
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Keycloak init error:", err);
        setLoading(false);
      });

    // Handle token refresh events
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) {
          setToken(keycloak.token);
        }
      }).catch(() => {
        setAuthenticated(false);
        setUser(null);
        setToken(undefined);
      });
    };

    // Handle logout events
    keycloak.onAuthLogout = () => {
      stopTokenRefresh();
      setAuthenticated(false);
      setUser(null);
      setToken(undefined);
    };

    // Handle auth success (token refresh)
    keycloak.onAuthRefreshSuccess = () => {
      setToken(keycloak.token);
    };

    return () => {
      stopTokenRefresh();
    };
  }, []);

  const login = useCallback(() => keycloak.login(), []);

  const logout = useCallback(() => {
    stopTokenRefresh();
    keycloak.logout({ redirectUri: window.location.origin });
  }, []);

  const register = useCallback(
    () => keycloak.register({ redirectUri: window.location.origin }),
    []
  );

  const getAccessToken = useCallback(async (): Promise<string> => {
    const newToken = await getKeycloakToken();
    setToken(newToken);
    return newToken;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authenticated,
        user,
        loading,
        token,
        login,
        logout,
        register,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
