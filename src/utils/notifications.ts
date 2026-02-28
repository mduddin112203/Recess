import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForNotifications(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
    });
  }

  return true;
}

export async function scheduleNotification(
  title: string,
  body: string,
  triggerDate: Date,
  identifier?: string
): Promise<string | null> {
  try {
    const secondsUntil = Math.max(1, (triggerDate.getTime() - Date.now()) / 1000);

    const id = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(secondsUntil) },
      identifier,
    });
    return id;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

export async function scheduleBreakReminder(
  breakTitle: string,
  breakStartTime: Date
): Promise<string | null> {
  const reminderTime = new Date(breakStartTime.getTime() - 5 * 60 * 1000);
  if (reminderTime <= new Date()) return null;

  return scheduleNotification(
    'Break Starting Soon',
    `"${breakTitle}" starts in 5 minutes`,
    reminderTime,
    `break-reminder-${breakStartTime.getTime()}`
  );
}

export async function scheduleBreakEndingReminder(
  breakType: string,
  endTime: Date
): Promise<string | null> {
  const reminderTime = new Date(endTime.getTime() - 2 * 60 * 1000);
  if (reminderTime <= new Date()) return null;

  return scheduleNotification(
    'Break Ending Soon',
    `Your ${breakType} break ends in 2 minutes`,
    reminderTime,
    `break-ending-${endTime.getTime()}`
  );
}

export async function scheduleItemReminder(
  itemTitle: string,
  itemStartTime: Date
): Promise<string | null> {
  const reminderTime = new Date(itemStartTime.getTime() - 10 * 60 * 1000);
  if (reminderTime <= new Date()) return null;

  return scheduleNotification(
    'Upcoming Schedule',
    `"${itemTitle}" starts in 10 minutes`,
    reminderTime,
    `schedule-reminder-${itemStartTime.getTime()}`
  );
}

export async function showImmediateNotification(title: string, body: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

export async function cancelNotification(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
}
