import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { getOrCreateKeypair } from '../lib/wallet';
import { SUI_NETWORK } from '../lib/config';
import { api } from '../lib/api';

interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthState {
  /** Google user info (null if not signed in) */
  googleUser: GoogleUser | null;
  /** Google ID token (null if not signed in) */
  idToken: string | null;
  /** Managed Sui keypair (null while loading) */
  keypair: Ed25519Keypair | null;
  /** Sui address derived from the managed keypair */
  address: string | null;
  /** SuiJsonRpcClient for reading chain state */
  suiClient: SuiJsonRpcClient;
  /** Whether auth + wallet initialization is complete */
  isReady: boolean;
  /** Called by GoogleLogin onSuccess */
  signInWithGoogle: (credentialResponse: { credential?: string }) => void;
  /** Sign out and clear keypair */
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const suiClient = new SuiJsonRpcClient({
  network: SUI_NETWORK,
  url: getJsonRpcFullnodeUrl(SUI_NETWORK),
});

const STORAGE_KEY_GOOGLE_USER = 'synapse_google_user';
const STORAGE_KEY_ID_TOKEN = 'synapse_id_token';

function loadPersistedAuth(): { user: GoogleUser | null; token: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GOOGLE_USER);
    const token = localStorage.getItem(STORAGE_KEY_ID_TOKEN);
    return { user: raw ? JSON.parse(raw) : null, token };
  } catch { return { user: null, token: null }; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [keypair, setKeypair] = useState<Ed25519Keypair | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(() => loadPersistedAuth().user);
  const [idToken, setIdToken] = useState<string | null>(() => loadPersistedAuth().token);

  // Restore persisted keypair on mount
  useEffect(() => {
    (async () => {
      try {
        const kp = await getOrCreateKeypair();
        setKeypair(kp);
      } catch (e) {
        console.error('[Auth] Failed to load keypair:', e);
      }
      setIsReady(true);
    })();
  }, []);

  // Persist googleUser + idToken to localStorage
  useEffect(() => {
    if (googleUser && idToken) {
      localStorage.setItem(STORAGE_KEY_GOOGLE_USER, JSON.stringify(googleUser));
      localStorage.setItem(STORAGE_KEY_ID_TOKEN, idToken);
    } else {
      localStorage.removeItem(STORAGE_KEY_GOOGLE_USER);
      localStorage.removeItem(STORAGE_KEY_ID_TOKEN);
    }
  }, [googleUser, idToken]);

  // Sync keypair with server after Google sign-in
  // CRITICAL: If cache was wiped, restore from server instead of overwriting
  useEffect(() => {
    if (!googleUser || !idToken || !keypair) return;

    let cancelled = false;

    const syncWalletWithServer = async () => {
      try {
        const serverWallet = await api.getClientWallet(idToken);
        if (cancelled) return;

        if (serverWallet) {
          const localAddress = keypair.getPublicKey().toSuiAddress();
          if (serverWallet.suiAddress !== localAddress) {
            // Server has a different wallet — cache was likely wiped
            // Restore the server wallet locally
            console.log('[Auth] Restoring wallet from server backup');
            const restoredKeypair = Ed25519Keypair.fromSecretKey(serverWallet.secretKey);
            setKeypair(restoredKeypair);
          }
        } else {
          // No server wallet exists — upload local one as backup
          if (cancelled) return;
          const secretKey = keypair.getSecretKey();
          const address = keypair.getPublicKey().toSuiAddress();
          await api.saveClientWallet(secretKey, address, idToken);
          console.log('[Auth] Client wallet backed up to server');
        }
      } catch (e) {
        // Non-fatal: wallet still works locally
        console.warn('[Auth] Failed to sync wallet with server:', e);
      }
    };

    syncWalletWithServer();
    return () => { cancelled = true; };
  }, [googleUser, idToken, keypair]);

  const signInWithGoogle = useCallback((credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;

    try {
      const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
      setGoogleUser({
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
      setIdToken(credentialResponse.credential);
    } catch (e) {
      console.error('[Auth] Failed to decode Google token:', e);
    }
  }, []);

  const signOut = useCallback(() => {
    setGoogleUser(null);
    setIdToken(null);
  }, []);

  const address = keypair?.getPublicKey().toSuiAddress() ?? null;

  return (
    <AuthContext.Provider
      value={{
        googleUser,
        idToken,
        keypair,
        address,
        suiClient,
        isReady,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
