# Mobile App Components Documentation

This document describes the primary reusable components and UI elements used in the `project_delta` mobile application.

## UI Components

### `Dialog`

- **File**: `components/ui/Dialog.tsx`
- **Description**: A premium, animated modal system using `BlurView` and `LinearGradient`. Used for alerts, successes, errors, and confirmation prompts.
- **Hook**: `useDialog()` provides methods like `showAlert`, `showConfirm`, `showError`, and `showSuccess`.
- **Usage**:
  ```tsx
  const { showConfirm } = useDialog();
  const confirmed = await showConfirm('Sign Out', 'Are you sure?');
  ```

---

## Navigation Components

### `TabBar`

- **File**: `components/navigation/TabBar.tsx`
- **Description**: The custom bottom navigation bar. Features haptic-like animations (spring scaling) when items are pressed.
- **Styling**: Uses reaching-through-dark-blur effect with `BlurView` and a green pill indicator for active states.

---

## Feature Components

### `AuthSheet`

- **File**: `components/auth/AuthSheet.tsx`
- **Description**: A complex bottom sheet that handles all authentication flows (Passkey, Google, Email/Password).
- **Key Features**:
  - **Dynamic Heights**: Automatically adjusts its height based on the current auth mode (login vs. signup vs. authenticating).
  - **Keyboard Handling**: Smoothly slides up when the keyboard is visible.
  - **Interactive Gestures**: Can be dismissed by dragging down.
  - **Branding**: Includes the "Delta ID" branding and custom SVG icons.

### `EditProfileModal`

- **File**: `components/profile/EditProfileModal.tsx`
- **Description**: A modal used within the `AccountScreen` to update user information such as username, weight, height, and unit preferences.
