import { useEffect } from 'react';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { useChatId } from '~/lib/stores/chatId';
import { useConvex, useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Button } from '@ui/Button';
import { Spinner } from '@ui/Spinner';

interface AutoConvexConnectionProps {
  // Your user ID from your auth system (optional but recommended for tracking)
  externalUserId?: string;
}

/**
 * Auto-provisioning Convex connection component.
 * Automatically creates a Convex project when the chat starts,
 * without requiring the user to have a Convex account.
 */
export function AutoConvexConnection({ externalUserId }: AutoConvexConnectionProps) {
  const convexClient = useConvex();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatId();

  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId && chatId
      ? {
          sessionId,
          chatId,
        }
      : 'skip',
  );

  // Auto-provision when component mounts and no project is connected
  useEffect(() => {
    if (sessionId && chatId && projectInfo === null) {
      convexClient.mutation(api.convexProjects.autoProvisionProject, {
        sessionId,
        chatId,
        externalUserId,
      }).catch((error) => {
        console.error('Failed to auto-provision Convex project:', error);
      });
    }
  }, [sessionId, chatId, projectInfo, convexClient, externalUserId]);

  // Retry handler for failed connections
  const handleRetry = async () => {
    if (!sessionId || !chatId) return;
    
    try {
      await convexClient.mutation(api.convexProjects.autoProvisionProject, {
        sessionId,
        chatId,
        externalUserId,
      });
    } catch (error) {
      console.error('Failed to retry auto-provision:', error);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="neutral"
        size="xs"
        className="text-xs font-normal"
        icon={<img className="size-4" height="16" width="16" src="/icons/Convex.svg" alt="Convex" />}
      >
        <ConnectionStatus projectInfo={projectInfo} />
      </Button>
    </div>
  );
}

/**
 * Inline status indicator that can be placed anywhere.
 * Shows the current connection status and auto-provisions if needed.
 */
export function AutoConvexStatus({ externalUserId }: AutoConvexConnectionProps) {
  const convexClient = useConvex();
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const chatId = useChatId();

  const projectInfo = useQuery(
    api.convexProjects.loadConnectedConvexProjectCredentials,
    sessionId && chatId
      ? {
          sessionId,
          chatId,
        }
      : 'skip',
  );

  // Auto-provision when component mounts and no project is connected
  useEffect(() => {
    if (sessionId && chatId && projectInfo === null) {
      convexClient.mutation(api.convexProjects.autoProvisionProject, {
        sessionId,
        chatId,
        externalUserId,
      }).catch((error) => {
        console.error('Failed to auto-provision Convex project:', error);
      });
    }
  }, [sessionId, chatId, projectInfo, convexClient, externalUserId]);

  if (projectInfo === undefined) {
    return <Spinner className="size-4" />;
  }

  if (projectInfo === null || projectInfo.kind === 'connecting') {
    return (
      <div className="flex items-center gap-2 text-xs text-content-secondary">
        <Spinner className="size-3" />
        <span>Setting up backend…</span>
      </div>
    );
  }

  if (projectInfo.kind === 'failed') {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500">
        <span>Backend setup failed</span>
        <button
          onClick={() => {
            if (sessionId && chatId) {
              convexClient.mutation(api.convexProjects.autoProvisionProject, {
                sessionId,
                chatId,
                externalUserId,
              });
            }
          }}
          className="underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-green-600">
      <span className="size-2 rounded-full bg-green-500" />
      <span>Backend ready</span>
    </div>
  );
}

type ProjectInfo = (typeof api.convexProjects.loadConnectedConvexProjectCredentials)['_returnType'];

function ConnectionStatus({ projectInfo }: { projectInfo: ProjectInfo | undefined }) {
  if (projectInfo === undefined) {
    return <Spinner className="size-3" />;
  }
  if (projectInfo === null) {
    return <span>Setting up…</span>;
  }
  switch (projectInfo.kind) {
    case 'failed':
      return <span className="text-red-500">Setup failed</span>;
    case 'connected':
      return <span className="text-green-600">Backend ready</span>;
    case 'connecting':
      return <span>Setting up…</span>;
    default: {
      const _exhaustiveCheck: never = projectInfo;
      return <span>Setting up…</span>;
    }
  }
}
