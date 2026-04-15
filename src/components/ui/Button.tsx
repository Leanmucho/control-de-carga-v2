import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
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

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: colors.primary,  text: '#fff' },
  secondary: { bg: colors.surface,  text: colors.text,      border: colors.border },
  danger:    { bg: colors.danger,   text: '#fff' },
  ghost:     { bg: 'transparent',   text: colors.textMuted,  border: 'transparent' },
  success:   { bg: colors.success,  text: '#fff' },
}

export function Button({
  label, onPress, variant = 'primary', loading, disabled, style, textStyle, fullWidth,
}: Props) {
  const v = variantStyles[variant]
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border ?? 'transparent', borderWidth: v.border ? 1 : 0 },
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: '600' },
})
