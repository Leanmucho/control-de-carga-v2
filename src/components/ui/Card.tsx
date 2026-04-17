import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { colors, radius, spacing } from '../../constants/theme'

interface Props {
  children?: React.ReactNode
  style?: ViewStyle
  padding?: keyof typeof spacing
  variant?: 'default' | 'elevated' | 'flat'
}

export function Card({ children, style, padding = 'md', variant = 'default' }: Props) {
  return (
    <View style={[
      styles.card,
      variant === 'elevated' && styles.elevated,
      variant === 'flat' && styles.flat,
      { padding: spacing[padding] },
      style,
    ]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.borderMid,
  },
  flat: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
})
