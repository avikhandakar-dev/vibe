import { useConvex } from 'convex/react';

import { useConvexAuth } from 'convex/react';
import { createContext, useContext, useEffect, useRef } from 'react';

import { sessionIdStore } from '~/lib/stores/sessionId';

import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import type { Id } from '@convex/_generated/dataModel';
import { useLocalStorage } from '@uidotdev/usehooks';
import { api } from '@convex/_generated/api';
import { toast } from 'sonner';
import { fetchOptIns } from '~/lib/convexOptins';
import { setChefDebugProperty } from 'chef-agent/utils/chefDebug';
import { useAuth } from '@workos-inc/authkit-react';
type ChefAuthState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'unauthenticated';
    }
  | {
      kind: 'fullyLoggedIn';
      sessionId: Id<'sessions'>;
    };

const ChefAuthContext = createContext<{
  state: ChefAuthState;
}>(null as unknown as { state: ChefAuthState });

export function useChefAuth() {
  const state = useContext(ChefAuthContext);
  if (state === null) {
    throw new Error('useChefAuth must be used within a ChefAuthProvider');
  }
  return state.state;
}

export function useChefAuthContext() {
  const state = useContext(ChefAuthContext);
  if (state === null) {
    throw new Error('useChefAuth must be used within a ChefAuthProvider');
  }
  return state;
}

export const SESSION_ID_KEY = 'sessionIdForConvex';

export const ChefAuthProvider = ({
  children,
  redirectIfUnauthenticated,
}: {
  children: React.ReactNode;
  redirectIfUnauthenticated: boolean;
}) => {
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const convex = useConvex();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const [sessionIdFromLocalStorage, setSessionIdFromLocalStorage] = useLocalStorage<Id<'sessions'> | null>(
    SESSION_ID_KEY,
    null,
  );
  const hasAlertedAboutOptIns = useRef(false);
  const authRetries = useRef(0);
  const { getAccessToken } = useAuth();

  useEffect(() => {
    function setSessionId(sessionId: Id<'sessions'> | null) {
      setSessionIdFromLocalStorage(sessionId);
      sessionIdStore.set(sessionId);
      if (sessionId) {
        setChefDebugProperty('sessionId', sessionId);
      }
    }

    const USE_AUTO_PROVISIONING_EFFECT = true;
    const isUnauthenticated = !isAuthenticated && !isConvexAuthLoading;

    // In auto-provisioning mode, don't clear session for unauthenticated users
    if (!USE_AUTO_PROVISIONING_EFFECT) {
      if (sessionId === undefined && isUnauthenticated) {
        setSessionId(null);
        return undefined;
      }

      if (sessionId !== null && isUnauthenticated) {
        setSessionId(null);
        return undefined;
      }
    }
    let verifySessionTimeout: ReturnType<typeof setTimeout> | null = null;

    async function verifySession() {
      const USE_AUTO_PROVISIONING = true;

      // For anonymous users in auto-provisioning mode, skip WorkOS auth checks
      if (sessionIdFromLocalStorage) {
        // For authenticated users, verify with WorkOS
        if (isAuthenticated) {
          try {
            await getAccessToken({});
            authRetries.current = 0;
          } catch (_e) {
            console.error('Unable to fetch access token from WorkOS');
            if (authRetries.current < 3 && verifySessionTimeout === null) {
              authRetries.current++;
              verifySessionTimeout = setTimeout(() => {
                void verifySession();
              }, 1000);
            }
            return;
          }

          let isValid: boolean = false;
          try {
            isValid = await convex.query(api.sessions.verifySession, {
              sessionId: sessionIdFromLocalStorage as Id<'sessions'>,
            });
          } catch (error) {
            console.error('Error verifying session', error);
            toast.error('Unexpected error verifying credentials');
            setSessionId(null);
            return;
          }
          if (isValid) {
            const optIns = await fetchOptIns(convex);
            if (optIns.kind === 'loaded' && optIns.optIns.length === 0) {
              setSessionId(sessionIdFromLocalStorage as Id<'sessions'>);
              return;
            }
            if (!hasAlertedAboutOptIns.current && optIns.kind === 'loaded' && optIns.optIns.length > 0) {
              toast.info('Please accept the Convex Terms of Service to continue');
              hasAlertedAboutOptIns.current = true;
            }
            if (hasAlertedAboutOptIns.current && optIns.kind === 'error') {
              toast.error('Unexpected error setting up your account.');
            }
            return;
          } else {
            setSessionId(null);
          }
        } else if (USE_AUTO_PROVISIONING) {
          // For anonymous users, just verify the session exists
          try {
            const isValid = await convex.query(api.sessions.verifySession, {
              sessionId: sessionIdFromLocalStorage as Id<'sessions'>,
            });
            if (isValid) {
              setSessionId(sessionIdFromLocalStorage as Id<'sessions'>);
              return;
            }
          } catch (error) {
            console.error('Error verifying anonymous session', error);
          }
          // Session invalid, clear it and create new one below
          setSessionId(null);
        }
      }

      // Create new session
      if (isAuthenticated) {
        try {
          const sessionId = await convex.mutation(api.sessions.startSession);
          setSessionId(sessionId);
        } catch (error) {
          console.error('Error creating session', error);
          setSessionId(null);
        }
      } else if (USE_AUTO_PROVISIONING) {
        // Create anonymous session for auto-provisioning mode
        try {
          const sessionId = await convex.mutation(api.sessions.startAnonymousSession);
          setSessionId(sessionId);
        } catch (error) {
          console.error('Error creating anonymous session', error);
          setSessionId(null);
        }
      }
    }

    void verifySession();
    return () => {
      if (verifySessionTimeout) {
        clearTimeout(verifySessionTimeout);
      }
    };
  }, [
    convex,
    sessionId,
    isAuthenticated,
    isConvexAuthLoading,
    sessionIdFromLocalStorage,
    setSessionIdFromLocalStorage,
    getAccessToken,
  ]);

  const USE_AUTO_PROVISIONING_STATE = true;
  const isLoading = sessionId === undefined || (!USE_AUTO_PROVISIONING_STATE && isConvexAuthLoading);
  const isUnauthenticated = sessionId === null || (!USE_AUTO_PROVISIONING_STATE && !isAuthenticated);
  const state: ChefAuthState = isLoading
    ? { kind: 'loading' }
    : isUnauthenticated
      ? { kind: 'unauthenticated' }
      : { kind: 'fullyLoggedIn', sessionId: sessionId as Id<'sessions'> };

  if (redirectIfUnauthenticated && state.kind === 'unauthenticated') {
    console.log('redirecting to /');
    // Hard navigate to avoid any potential state leakage
    window.location.href = '/';
  }

  return <ChefAuthContext.Provider value={{ state }}>{children}</ChefAuthContext.Provider>;
};
