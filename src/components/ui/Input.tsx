import React, { useState } from 'react'
import {
  TextInput, Text, View, StyleSheet, ViewStyle,
} from 'react-native'
import { colors, radius, spacing } from '../../constants/theme'

interface Props {
  label?: string
  error?: string
  containerStyle?: ViewStyle
  style?: ViewStyle
  placeholder?: string
  value?: string
  onChangeText?: (text: string) => void
  onFocus?: (e: any) => void
  onBlur?: (e: any) => void
  keyboardType?: any
  autoCapitalize?: any
  autoCorrect?: boolean
  secureTextEntry?: boolean
  autoFocus?: boolean
}

export function Input({ label, error, containerStyle, style, onFocus, onBlur, value, onChangeText, ...rest }: Props) {
  const [focused, setFocused] = useState(false)

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor={colors.textFaint}
        value={value}
        onChangeText={onChangeText}
        onFocus={e => { setFocused(true); onFocus?.(e) }}
        onBlur={e => { setFocused(false); onBlur?.(e) }}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  label: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderMid,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 46,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 2 },
})
