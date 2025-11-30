import { useStoreMessageHistory } from './useStoreMessageHistory';
import { useExistingInitializeChat, useHomepageInitializeChat } from './useInitializeChat';
import { useAutoInitializeChat, useAutoInitializeExistingChat } from './useAutoInitializeChat';
import { useInitialMessages } from './useInitialMessages';
import { useProjectInitializer } from './useProjectInitializer';
import { useTeamsInitializer } from './useTeamsInitializer';
import { useExistingChatContainerSetup, useNewChatContainerSetup } from './useContainerSetup';
import { useBackupSyncState } from './history';
import { useState } from 'react';
import { useConvexSessionIdOrNullOrLoading } from '~/lib/stores/sessionId';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';

// Set this to true to use auto-provisioning (no Convex login required)
const USE_AUTO_PROVISIONING = true;

export function useConvexChatHomepage(chatId: string, externalUserId?: string) {
  // Only initialize teams if not using auto-provisioning
  if (!USE_AUTO_PROVISIONING) {
    useTeamsInitializer();
  }
  useProjectInitializer(chatId);
  const [chatInitialized, setChatInitialized] = useState(false);
  
  // Use auto-provisioning or OAuth-based initialization
  const initializeChatOAuth = useHomepageInitializeChat(chatId, setChatInitialized);
  const initializeChatAuto = useAutoInitializeChat(chatId, setChatInitialized, externalUserId);
  const initializeChat = USE_AUTO_PROVISIONING ? initializeChatAuto : initializeChatOAuth;
  
  const storeMessageHistory = useStoreMessageHistory();
  useNewChatContainerSetup();
  const initialMessages = useInitialMessages(chatInitialized ? chatId : undefined);
  useBackupSyncState(chatId, initialMessages?.loadedSubchatIndex, initialMessages?.deserialized);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const subchats = useQuery(
    api.subchats.get,
    sessionId && chatInitialized
      ? {
          chatId,
          sessionId,
        }
      : 'skip',
  );

  return {
    initializeChat,
    storeMessageHistory,
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
    subchats,
  };
}

export function useConvexChatExisting(chatId: string, externalUserId?: string) {
  // Only initialize teams if not using auto-provisioning
  if (!USE_AUTO_PROVISIONING) {
    useTeamsInitializer();
  }
  useProjectInitializer(chatId);
  
  // Use auto-provisioning or OAuth-based initialization
  const initializeChatOAuth = useExistingInitializeChat(chatId);
  const initializeChatAuto = useAutoInitializeExistingChat(chatId, externalUserId);
  const initializeChat = USE_AUTO_PROVISIONING ? initializeChatAuto : initializeChatOAuth;
  
  const initialMessages = useInitialMessages(chatId);
  useBackupSyncState(chatId, initialMessages?.loadedSubchatIndex, initialMessages?.deserialized);
  const storeMessageHistory = useStoreMessageHistory();
  useExistingChatContainerSetup(initialMessages?.loadedChatId);
  const sessionId = useConvexSessionIdOrNullOrLoading();
  const subchats = useQuery(
    api.subchats.get,
    sessionId
      ? {
          chatId,
          sessionId,
        }
      : 'skip',
  );

  return {
    initialMessages: !initialMessages ? initialMessages : initialMessages?.deserialized,
    initializeChat,
    storeMessageHistory,
    subchats,
  };
}
