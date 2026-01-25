import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import keycloak from "../lib/keycloak";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  preferredUsername?: string;
}

interface AuthContextValue {
  authenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  register: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  authenticated: false,
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  register: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    keycloak
      .init({
        onLoad: "check-sso",
        silentCheckSsoRedirectUri:
          window.location.origin + "/silent-check-sso.html",
        pkceMethod: "S256",
      })
      .then((auth) => {
        setAuthenticated(auth);
        if (auth && keycloak.tokenParsed) {
          setUser({
            id: keycloak.tokenParsed.sub!,
            email: keycloak.tokenParsed.email as string,
            name: keycloak.tokenParsed.name as string,
            preferredUsername: keycloak.tokenParsed
              .preferred_username as string,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Keycloak init error:", err);
        setLoading(false);
      });

    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => {
        setAuthenticated(false);
        setUser(null);
      });
    };

    keycloak.onAuthLogout = () => {
      setAuthenticated(false);
      setUser(null);
    };
  }, []);

  const login = () => keycloak.login();
  const logout = () => keycloak.logout({ redirectUri: window.location.origin });
  const register = () =>
    keycloak.register({ redirectUri: window.location.origin });

  return (
    <AuthContext.Provider
      value={{ authenticated, user, loading, login, logout, register }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
