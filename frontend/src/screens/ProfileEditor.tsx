import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useProfileStore } from '../stores/profileStore';
import { Colors, Fonts, Spacing, Radius } from '../theme';
import { FitnessGoal, ActivityLevel } from '../types/profile';

/**
 * ProfileEditor Component
 * Full-screen modal for editing profile information
 * 
 * Features:
 * - Profile picture upload with camera/gallery picker
 * - Editable fields: name, location, weight, height, age, goal, activity level
 * - Real-time validation with inline error messages
 * - Save changes with backend persistence
 * - Cancel button to navigate back
 * - Upload progress indicator
 * - Success/error message display
 * 
 * Requirements: 8.2, 8.3, 9.1-9.7, 10.1-10.8, 11.1-11.4, 17.1-17.6, 19.3
 */

interface ValidationErrors {
  name?: string;
  location?: string;
  weight?: string;
  height?: string;
  age?: string;
}

export default function ProfileEditor() {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile, isLoading, error, updateProfile, uploadProfilePicture, clearError } = useProfileStore();

  // Form state
  const [name, setName] = useState(profile?.name || '');
  const [location, setLocation] = useState(profile?.location || '');
  const [weight, setWeight] = useState(profile?.weight?.toString() || '');
  const [height, setHeight] = useState(profile?.height?.toString() || '');
  const [age, setAge] = useState(profile?.age?.toString() || '');
  const [goal, setGoal] = useState<FitnessGoal | undefined>(profile?.goal);
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | undefined>(profile?.activity_level);
  const [profilePictureUri, setProfilePictureUri] = useState(profile?.profile_picture_url || '');

  // Validation state
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Pre-populate fields when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setLocation(profile.location || '');
      setWeight(profile.weight?.toString() || '');
      setHeight(profile.height?.toString() || '');
      setAge(profile.age?.toString() || '');
      setGoal(profile.goal);
      setActivityLevel(profile.activity_level);
      setProfilePictureUri(profile.profile_picture_url || '');
    }
  }, [profile]);

  // Track changes
  useEffect(() => {
    const changed =
      name !== (profile?.name || '') ||
      location !== (profile?.location || '') ||
      weight !== (profile?.weight?.toString() || '') ||
      height !== (profile?.height?.toString() || '') ||
      age !== (profile?.age?.toString() || '') ||
      goal !== profile?.goal ||
      activityLevel !== profile?.activity_level;
    setHasChanges(changed);
  }, [name, location, weight, height, age, goal, activityLevel, profile]);

  // Validation functions
  const validateName = (value: string): string | undefined => {
    if (value.length < 2) return 'Name must be at least 2 characters';
    if (value.length > 50) return 'Name must be at most 50 characters';
    return undefined;
  };

  const validateLocation = (value: string): string | undefined => {
    if (value.trim().length === 0) return 'Location cannot be empty';
    return undefined;
  };

  const validateWeight = (value: string): string | undefined => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'Weight must be a number';
    if (num < 20) return 'Weight must be at least 20 kg';
    if (num > 300) return 'Weight must be at most 300 kg';
    return undefined;
  };

  const validateHeight = (value: string): string | undefined => {
    const num = parseFloat(value);
    if (isNaN(num)) return 'Height must be a number';
    if (num < 100) return 'Height must be at least 100 cm';
    if (num > 250) return 'Height must be at most 250 cm';
    return undefined;
  };

  const validateAge = (value: string): string | undefined => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return 'Age must be a number';
    if (num < 13) return 'Age must be at least 13 years';
    if (num > 120) return 'Age must be at most 120 years';
    return undefined;
  };

  // Real-time validation
  const validateAllFields = (): boolean => {
    const errors: ValidationErrors = {};

    const nameError = validateName(name);
    if (nameError) errors.name = nameError;

    if (location) {
      const locationError = validateLocation(location);
      if (locationError) errors.location = locationError;
    }

    if (weight) {
      const weightError = validateWeight(weight);
      if (weightError) errors.weight = weightError;
    }

    if (height) {
      const heightError = validateHeight(height);
      if (heightError) errors.height = heightError;
    }

    if (age) {
      const ageError = validateAge(age);
      if (ageError) errors.age = ageError;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate on field change
  useEffect(() => {
    if (hasChanges) {
      validateAllFields();
    }
  }, [name, location, weight, height, age, hasChanges]);

  // Image picker
  const handleChangePhoto = async () => {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to change your profile picture.');
      return;
    }

    // Show options
    Alert.alert(
      'Change Profile Picture',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: handleChooseFromGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera permissions to take a photo.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleImageSelected(result.assets[0].uri);
    }
  };

  const handleChooseFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handleImageSelected(result.assets[0].uri);
    }
  };

  const handleImageSelected = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      // Update local preview immediately
      setProfilePictureUri(uri);

      // Upload to backend
      await uploadProfilePicture(uri);
      Alert.alert('Success', 'Profile picture updated successfully');
    } catch (error) {
      console.error('Failed to upload profile picture:', error);
      // Revert to original picture on error
      setProfilePictureUri(profile?.profile_picture_url || '');
      Alert.alert('Error', 'Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Save changes
  const handleSaveChanges = async () => {
    // Validate all fields
    if (!validateAllFields()) {
      Alert.alert('Validation Error', 'Please fix the errors before saving.');
      return;
    }

    try {
      clearError();

      // Prepare update data
      const updates: any = {
        name,
      };

      if (location) updates.location = location;
      if (weight) updates.weight = parseFloat(weight);
      if (height) updates.height = parseFloat(height);
      if (age) updates.age = parseInt(age, 10);
      if (goal) updates.goal = goal;
      if (activityLevel) updates.activity_level = activityLevel;

      // Update profile
      await updateProfile(updates);

      // Show success message
      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Failed to update profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  // Cancel
  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          {
            text: 'Keep Editing',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const isFormValid = hasChanges && Object.keys(validationErrors).length === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSaveChanges}
          style={[styles.headerButton, !isFormValid && styles.headerButtonDisabled]}
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[styles.saveButtonText, !isFormValid && styles.saveButtonTextDisabled]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Picture */}
        <View style={styles.section}>
          <View style={styles.profilePictureContainer}>
            {profilePictureUri ? (
              <Image source={{ uri: profilePictureUri }} style={styles.profilePicture} />
            ) : (
              <View style={[styles.profilePicture, styles.profilePicturePlaceholder]}>
                <Ionicons name="person" size={64} color={Colors.textMuted} />
              </View>
            )}
            {isUploadingImage && (
              <View style={styles.uploadOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handleChangePhoto}
              disabled={isUploadingImage}
            >
              <Ionicons name="camera" size={20} color={Colors.textPrimary} />
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={[styles.input, validationErrors.name && styles.inputError]}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textMuted}
            />
            {validationErrors.name && (
              <Text style={styles.errorText}>{validationErrors.name}</Text>
            )}
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={[styles.input, validationErrors.location && styles.inputError]}
              value={location}
              onChangeText={setLocation}
              placeholder="Enter your location"
              placeholderTextColor={Colors.textMuted}
            />
            {validationErrors.location && (
              <Text style={styles.errorText}>{validationErrors.location}</Text>
            )}
          </View>
        </View>

        {/* Body Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Body Stats</Text>

          {/* Weight */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Weight (kg)</Text>
            <TextInput
              style={[styles.input, validationErrors.weight && styles.inputError]}
              value={weight}
              onChangeText={setWeight}
              placeholder="Enter your weight"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
            {validationErrors.weight && (
              <Text style={styles.errorText}>{validationErrors.weight}</Text>
            )}
          </View>

          {/* Height */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={[styles.input, validationErrors.height && styles.inputError]}
              value={height}
              onChangeText={setHeight}
              placeholder="Enter your height"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
            {validationErrors.height && (
              <Text style={styles.errorText}>{validationErrors.height}</Text>
            )}
          </View>

          {/* Age */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Age (years)</Text>
            <TextInput
              style={[styles.input, validationErrors.age && styles.inputError]}
              value={age}
              onChangeText={setAge}
              placeholder="Enter your age"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
            {validationErrors.age && (
              <Text style={styles.errorText}>{validationErrors.age}</Text>
            )}
          </View>
        </View>

        {/* Fitness Goals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fitness Goals</Text>

          {/* Goal */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Goal</Text>
            <View style={styles.pickerContainer}>
              {(['lose_fat', 'build_muscle', 'maintain'] as FitnessGoal[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.pickerOption,
                    goal === g && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setGoal(g)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      goal === g && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {g === 'lose_fat' ? 'Lose Fat' : g === 'build_muscle' ? 'Build Muscle' : 'Maintain'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Activity Level */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Activity Level</Text>
            <View style={styles.pickerContainer}>
              {(['sedentary', 'light', 'moderate', 'active', 'very_active'] as ActivityLevel[]).map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.pickerOption,
                    activityLevel === level && styles.pickerOptionSelected,
                  ]}
                  onPress={() => setActivityLevel(level)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      activityLevel === level && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {level.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={Colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: Spacing.xs,
    minWidth: 60,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.xl,
    fontWeight: '600',
  },
  saveButtonText: {
    color: Colors.primary,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: Colors.textMuted,
  },
  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  // Section
  section: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  // Profile Picture
  profilePictureContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card,
  },
  profilePicturePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 60,
    width: 120,
    height: 120,
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  changePhotoText: {
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.md,
    fontWeight: '600',
  },
  // Input Group
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.sm,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.md,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    color: Colors.error,
    fontSize: Fonts.sizes.xs,
    marginTop: Spacing.xs,
  },
  // Picker
  pickerContainer: {
    gap: Spacing.sm,
  },
  pickerOption: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  pickerOptionSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pickerOptionText: {
    color: Colors.textSecondary,
    fontSize: Fonts.sizes.md,
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderLeftWidth: 4,
    borderLeftColor: Colors.error,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: Radius.sm,
    gap: Spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: Fonts.sizes.sm,
  },
  // Bottom Spacing
  bottomSpacer: {
    height: Spacing.xl,
  },
});
