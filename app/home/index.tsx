import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useAuth } from 'components/AuthProvider';
import { supabase } from 'lib/supabase';

export default function Home() {
  const { user, signOut } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      const { data, error } = await supabase.from('todos').select('*').eq('owner_id', user.id);
      if (error) {
        console.error(error);
      } else if (mounted) {
        setRows(data ?? []);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 12 }}>Hi {user?.email}</Text>
      <Pressable
        onPress={signOut}
        style={{ padding: 12, backgroundColor: '#0B5FFF', borderRadius: 8 }}>
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Sign out</Text>
      </Pressable>

      <Text style={{ marginTop: 20, marginBottom: 8 }}>Your rows (sample)</Text>
      {rows.map((r) => (
        <Text key={r.id}>- {r.title}</Text>
      ))}
    </View>
  );
}
