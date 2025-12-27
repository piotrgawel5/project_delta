import { getPreviousWeekDates, formatDate } from 'utils/dates';
import { Pressable, Text, View } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { ScrollView } from 'react-native-gesture-handler';

export const DatePickerStrip = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const days = getPreviousWeekDates();

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: false });
    }
  }, []);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 12 }}>
      <View className="flex-row gap-3 pt-3">
        {days.map((date) => {
          const isSelected = selectedDate?.toDateString() === date.toDateString();

          const { day, weekday } = formatDate(date);

          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => setSelectedDate(date)}
              className={`w-20 items-center justify-center rounded-2xl px-3 py-3 ${
                isSelected ? 'bg-emerald-500' : 'bg-neutral-800'
              }`}>
              <Text
                className={`text-xs font-semibold tracking-wider uppercase ${
                  isSelected ? 'text-white/80' : 'text-neutral-400'
                }`}>
                {weekday}
              </Text>

              <Text
                className={`mt-1 text-2xl font-bold ${
                  isSelected ? 'text-white' : 'text-neutral-100'
                }`}>
                {day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
};
