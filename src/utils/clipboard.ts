import { Alert } from 'react-native';

export async function copyToClipboard(text: string): Promise<boolean> {
  Alert.alert(
    'Copy Code',
    `Your code: ${text}\n\nLong press to copy this text.`,
    [{ text: 'OK' }]
  );
  return true;
}
