import React, { useState } from 'react'
import {
  TextInput, Text, View, StyleSheet, ViewStyle, TouchableOpacity,
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

export function Input({ label, error, containerStyle, style, onFocus, onBlur, value, onChangeText, secureTextEntry, ...rest }: Props) {
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(!!secureTextEntry)

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrap}>
        <TextInput
          style={[
            styles.input,
            focused && styles.inputFocused,
            error && styles.inputError,
            secureTextEntry && styles.inputWithToggle,
            style,
          ]}
          placeholderTextColor={colors.textFaint}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry ? hidden : false}
          onFocus={e => { setFocused(true); onFocus?.(e) }}
          onBlur={e => { setFocused(false); onBlur?.(e) }}
          {...rest}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.toggleBtn}
            onPress={() => setHidden(h => !h)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.toggleText}>{hidden ? 'Mostrar' : 'Ocultar'}</Text>
          </TouchableOpacity>
        )}
      </View>
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
  inputWrap: { position: 'relative', justifyContent: 'center' },
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
  inputWithToggle: { paddingRight: 84 },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, marginTop: 2 },
  toggleBtn: {
    position: 'absolute',
    right: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  toggleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
})
