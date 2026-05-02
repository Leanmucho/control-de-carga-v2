import { Tabs } from 'expo-router'
import { colors } from '../../src/constants/theme'
import { Text } from 'react-native'
import { useKeepAwake } from 'expo-keep-awake'
import { OfflineSyncBanner } from '../../src/components/OfflineSyncBanner'

export default function MainLayout() {
  useKeepAwake()

  return (
    <>
    <OfflineSyncBanner />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="turno"
        options={{
          title: 'Turno',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="carga"
        options={{
          title: 'Cargas',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>S</Text>,
        }}
      />
      <Tabs.Screen
        name="historial"
        options={{
          title: 'Historial',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📋</Text>,
        }}
      />
    </Tabs>
    </>
  )
}
