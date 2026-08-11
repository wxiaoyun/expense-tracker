import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { BlurView } from 'expo-blur';

const GlassSheet: React.FC<{ 
  visible: boolean; 
  onRequestClose: () => void; 
  children: React.ReactNode; 
  style?: any; 
}> = ({ visible, onRequestClose, children, style }) => {
  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onRequestClose}
      animationType="slide"
    >
      <View style={styles.backdrop}>
        <BlurView intensity={70} tint="systemMaterial" style={[styles.container, style]}>
          {children}
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    ...StyleSheet.absoluteFill,
    width: '90%',
    maxHeight: '80%',
  },
});

export default GlassSheet;
