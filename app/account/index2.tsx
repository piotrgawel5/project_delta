import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Button } from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

import '../../global.css';
import { DatePickerStrip } from 'components/DatePickerStrip';
import ActivityMetrics from 'components/ActivityMetrics';
import { Link } from 'expo-router';

export default function App() {
  return (
    <View className="flex-1 bg-black">
      <ScrollView className="mt-9 bg-black" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="mt-2 flex-row items-center justify-between bg-black px-5">
          <View className="flex-row items-center">
            <Image
              source={{ uri: 'https://i.pravatar.cc/150?img=12' }}
              className="border-primary h-12 w-12 rounded-full border-2"
            />
            <View className="ml-3">
              <Text className="text-xs font-semibold text-gray-400 uppercase">Good Morning</Text>
              <Text className="text-xl font-bold text-white">Piotr</Text>
            </View>
          </View>
          <TouchableOpacity className="bg-card relative h-10 w-10 items-center justify-center rounded-full">
            <Ionicons name="notifications" size={20} color="white" />
            <View className="bg-accent border-card absolute top-2.5 right-3 h-2 w-2 rounded-full border" />
          </TouchableOpacity>
        </View>
        <DatePickerStrip />
        <ActivityMetrics />
      </ScrollView>
    </View>
  );
}
