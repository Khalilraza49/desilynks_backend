export const NOTIFICATION_QUEUE = 'notifications';
export const NOTIFICATION_QUEUE_CHAT = 'notifications-chat';
export const NOTIFICATION_REALTIME_CHANNEL = 'notification:realtime';

export enum NotificationJobName {
  SEND_NOTIFICATION = 'send-notification',
  DELETE_NOTIFICATION = 'delete-contextual-notification',
  FANOUT_NOTIFICATION = 'fanout-notification',
  SEND_CHAT_PUSH = 'send-chat-push',
}

export const SEND_NOTIFICATION_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 604800 },
};

export interface NotificationReferenceIds {
  postId?: string;
  commentId?: string;
  workRequestId?: string;
  jobApplicationId?: string;
  productAdOfferId?: string;
  groupId?: string;
  eventId?: string;
  needAWorkerAppId?: string;
  propertyId?: string;
  productAdId?: string;
  workerProfileId?: string;
}

export interface QueueNotificationParams {
  type: string;
  recipientId: string;
  actorId: string;
  title: string;
  body: string;
  referenceIds?: NotificationReferenceIds;
  data?: Record<string, string>;
}

export interface SendNotificationJobData extends QueueNotificationParams {
  notificationId: string;
}

export interface DeleteNotificationJobData {
  recipientId?: string;
  actorId?: string;
  type?: string;
  referenceIds: NotificationReferenceIds;
}

export interface FanoutNotificationJobData {
  audience:
    | {
        kind: 'GROUP_MEMBERS';
        groupId: string;
      }
    | {
        kind: 'WORKER_SERVICE';
        service: string;
      };
  excludeUserIds?: string[];
  notification: Omit<QueueNotificationParams, 'recipientId'>;
}

export interface SendChatPushJobData {
  receiverId: string;
  senderId: string;
  senderName: string;
  content: string;
  conversationId: string;
  messageId: string;
}
