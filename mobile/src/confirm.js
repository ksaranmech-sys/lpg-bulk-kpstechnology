import { Alert } from 'react-native';

// Promise wrapper so screens can `if (!(await confirm(...))) return;` like window.confirm on web.
export function confirm(message, okText = 'Delete') {
  return new Promise((resolve) => {
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okText, style: okText === 'Delete' ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
