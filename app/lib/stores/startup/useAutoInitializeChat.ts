import { useConvex } from 'convex/react';
import { waitForConvexSessionId } from '~/lib/stores/sessionId';
import { useCallback } from 'react';
import { api } from '@convex/_generated/api';
import { ContainerBootState, waitForBootStepCompleted } from '~/lib/stores/containerBootState';
import { toast } from 'sonner';
import { waitForConvexProjectConnection } from '~/lib/stores/convexProject';

const CREATE_PROJECT_TIMEOUT = 20000;

/**
 * Initialize chat with auto-provisioning.
 * This doesn't require the user to be logged into Convex or select a team.
 * Projects are created under your team automatically.
 */
export function useAutoInitializeChat(
  chatId: string,
  setChatInitialized: (chatInitialized: boolean) => void,
  externalUserId?: string,
) {
  const convex = useConvex();

  return useCallback(async () => {
    try {
      const sessionId = await waitForConvexSessionId('useAutoInitializeChat');

      // Initialize the chat without project params (will use auto-provisioning)
      await convex.mutation(api.messages.initializeChatAuto, {
        id: chatId,
        sessionId,
        externalUserId,
      });

      // Wait for the Convex project to be successfully created
      await Promise.race([
        waitForConvexProjectConnection(),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, CREATE_PROJECT_TIMEOUT);
        }),
      ]);

      setChatInitialized(true);

      // Wait for the WebContainer to have its snapshot loaded before sending a message.
      await waitForBootStepCompleted(ContainerBootState.LOADING_SNAPSHOT);
      return true;
    } catch (error) {
      console.error('Failed to initialize chat with auto-provisioning:', error);
      if (error instanceof Error && error.message === 'Connection timeout') {
        toast.error('Backend setup timed out. Please try again.');
      } else {
        toast.error('Failed to set up backend. Please try again.');
      }
      return false;
    }
  }, [convex, chatId, setChatInitialized, externalUserId]);
}

/**
 * Initialize an existing chat with auto-provisioning if needed.
 */
export function useAutoInitializeExistingChat(chatId: string, externalUserId?: string) {
  const convex = useConvex();

  return useCallback(async () => {
    try {
      const sessionId = await waitForConvexSessionId('useAutoInitializeExistingChat');

      // Check if project is already connected
      const projectInfo = await convex.query(api.convexProjects.loadConnectedConvexProjectCredentials, {
        sessionId,
        chatId,
      });

      // If not connected, auto-provision
      if (!projectInfo || projectInfo.kind !== 'connected') {
        await convex.mutation(api.convexProjects.autoProvisionProject, {
          sessionId,
          chatId,
          externalUserId,
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize existing chat:', error);
      return false;
    }
  }, [convex, chatId, externalUserId]);
}
