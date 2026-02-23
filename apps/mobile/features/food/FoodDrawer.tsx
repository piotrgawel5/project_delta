import { View, Text, FlatList } from 'react-native';
import { useHealthStore } from '@store/healthStore';
import { useMemo } from 'react';
import BottomSheet from '@gorhom/bottom-sheet';

export function FoodDrawer() {
  const snapPoints = useMemo(() => ['50%', '90%'], []);
  const food = useHealthStore((s) => s.food);

  return (
    <BottomSheet
      snapPoints={snapPoints}
      index={-1}
      enablePanDownToClose
      backgroundStyle={{ backgroundColor: '#111' }}
      handleIndicatorStyle={{ backgroundColor: '#444' }}>
      <View className="px-4">
        <Text className="mb-4 text-lg font-semibold text-white">Today s food</Text>

        <FlatList
          data={food}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="mb-3 rounded-lg bg-neutral-900 p-3">
              <Text className="font-medium text-white">{item.name}</Text>
              <Text className="text-sm text-neutral-400">
                {item.macros.calories} kcal · P {item.macros.protein}g · C {item.macros.carbs}g · F{' '}
                {item.macros.fats}g
              </Text>
            </View>
          )}
        />
      </View>
    </BottomSheet>
  );
}
