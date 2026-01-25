import { View, Text } from 'react-native';
import { BlurView } from 'expo-blur';
import { DrawerContentScrollView } from '@react-navigation/drawer';

export function Drawer(props: any) {
  return (
    <BlurView intensity={60} tint="dark" style={{ flex: 1 }}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={{
          paddingTop: 60,
        }}>
        <View className="px-6">
          <Text className="mb-6 text-2xl font-semibold text-white">Menu</Text>

          {props.state.routeNames.map((name: string, index: number) => (
            <Text
              key={name}
              className="py-4 text-lg text-white/80"
              onPress={() => props.navigation.navigate(name)}>
              {name}
            </Text>
          ))}
        </View>
      </DrawerContentScrollView>
    </BlurView>
  );
}
