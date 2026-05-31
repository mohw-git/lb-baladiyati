/** Controls delivery channels for createAndSend (in-app + realtime always). */
export type NotificationSendOptions = {
  /** When false, skips FCM/device push. Defaults to true. */
  push?: boolean;
};
