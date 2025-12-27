import { Pressable, Text } from 'react-native';
import { useHealthStore } from 'store/healthStore';
import { nanoid } from 'nanoid/non-secure';

export function QuickAddFood() {
  const addFood = useHealthStore((s) => s.addFood);

  const addSampleMeal = () => {
    addFood({
      id: nanoid(),
      name: 'Chicken + Rice',
      macros: {
        calories: 520,
        protein: 42,
        carbs: 55,
        fats: 14,
      },
      timestamp: Date.now(),
      category: 'body',
    });
  };

  return (
    <Pressable
      onPress={addSampleMeal}
      className="mt-6 h-12 items-center justify-center rounded-xl bg-white">
      <Text className="font-medium text-black">Quick add meal</Text>
    </Pressable>
  );
}
