import React from 'react'
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle,
} from 'react-native'
import { colors, radius, spacing } from '../../constants/theme'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

interface Props {
  label: string
  onPress: () => void
  variant?: Variant
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  fullWidth?: boolean
}

const VARIANTS: Record<Variant, { bg: string; text: string; border: string }> = {
  primary:   { bg: colors.primary,      text: '#fff',           border: 'transparent' },
  secondary: { bg: 'transparent',       text: colors.textMuted, border: colors.borderMid },
  danger:    { bg: colors.danger,       text: '#fff',           border: 'transparent' },
  ghost:     { bg: 'transparent',       text: colors.primary,   border: 'transparent' },
  success:   { bg: colors.success,      text: '#fff',           border: 'transparent' },
}

export function Button({
  label, onPress, variant = 'primary', loading, disabled, style, textStyle, fullWidth,
}: Props) {
  const v = VARIANTS[variant]
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: v.border !== 'transparent' ? 1 : 0,
        },
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={v.text} size="small" />
        : <Text style={[styles.label, { color: v.text }, textStyle]}>{label}</Text>
      }
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.4 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
})
