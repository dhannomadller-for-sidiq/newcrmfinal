import React from 'react';
import { TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const NativeDTP = Platform.OS !== 'web' ? DateTimePicker : null;

export function DateField({ value, onChange, showPicker, setShowPicker, styles }: {
  value: Date | null;
  onChange: (d: Date) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  styles: any;
}) {
  if (!showPicker) return null;

  if (Platform.OS === 'web') {
    return (
      <TextInput
        style={[styles.input, { marginTop: 4 }]}
        placeholder="Enter date: YYYY-MM-DD"
        placeholderTextColor="#475569"
        defaultValue={value ? value.toISOString().split('T')[0] : ''}
        onChangeText={(t) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
            const d = new Date(t);
            if (!isNaN(d.getTime())) {
              onChange(d);
              setShowPicker(false);
            }
          }
        }}
        autoFocus
      />
    );
  }

  if (!NativeDTP) return null;

  return (
    <NativeDTP
      mode="date"
      value={value ?? new Date()}
      minimumDate={new Date()}
      onChange={(_e: any, d: Date | undefined) => {
        setShowPicker(Platform.OS === 'ios');
        if (d) onChange(d);
      }}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      themeVariant="dark"
    />
  );
}
