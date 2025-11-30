import { useConvexSessionId } from '~/lib/stores/sessionId';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { useChatId } from '~/lib/stores/chatId';
import { Link1Icon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { useEffect, useState } from 'react';

interface AutoConnectButtonProps {
  // Optional: Your own user ID from your auth system
  externalUserId?: string;
  // Auto-connect on mount (no button click needed)
  autoConnect?: boolean;
}

/**
 * Auto-connect button that provisions a Convex project without requiring
 * the user to have a Convex account. Projects are created under your team.
 */
export function AutoConnectButton({ externalUserId, autoConnect = false }: AutoConnectButtonProps) {
  const convexClient = useConvex();
  const sessionId = useConvexSessionId();
  const chatId = useChatId();
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasAutoConnected, setHasAutoConnected] = useState(false);

  const credentials = useQuery(api.convexProjects.loadConnectedConvexProjectCredentials, {
    sessionId,
    chatId,
  });

  const handleConnect = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    try {
      await convexClient.mutation(api.convexProjects.autoProvisionProject, {
        sessionId,
        chatId,
        externalUserId,
      });
    } catch (error) {
      console.error('Failed to auto-provision project:', error);
      setIsConnecting(false);
    }
  };

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && !hasAutoConnected && credentials === null) {
      setHasAutoConnected(true);
      handleConnect();
    }
  }, [autoConnect, hasAutoConnected, credentials]);

  // Reset connecting state when credentials change
  useEffect(() => {
    if (credentials?.kind === 'connected' || credentials?.kind === 'failed') {
      setIsConnecting(false);
    }
  }, [credentials]);

  const isLoading = credentials === undefined || credentials?.kind === 'connecting' || isConnecting;
  const isConnected = credentials?.kind === 'connected';
  const isFailed = credentials?.kind === 'failed';

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600">
        <Link1Icon />
        <span>Connected to Convex</span>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-red-500">Failed to connect: {credentials.errorMessage}</p>
        <Button
          icon={<Link1Icon />}
          onClick={handleConnect}
          disabled={isLoading}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Button
      icon={<Link1Icon />}
      loading={isLoading}
      disabled={isLoading}
      onClick={handleConnect}
    >
      {isLoading ? 'Setting up backend…' : 'Connect Backend'}
    </Button>
  );
}
