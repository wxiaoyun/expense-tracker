import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Modal } from 'react-native';

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
      <View style={styles.backdrop} onTouchStart={onRequestClose}>
        <View style={[styles.container, style]}>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    ...StyleSheet.absoluteFillObject,
    width: '90%',
    maxHeight: '80%',
  },
});

export default GlassSheet;
