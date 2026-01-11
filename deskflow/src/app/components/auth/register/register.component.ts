import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = signal<string>('');
  success = signal<string>('');
  isLoading = signal<boolean>(false);
  showPassword = signal<boolean>(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    // If already authenticated, redirect to desktop
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
    }
  }

  async onSubmit(): Promise<void> {
    this.error.set('');
    this.success.set('');

    // Validation
    if (!this.email || !this.password || !this.confirmPassword) {
      this.error.set('Por favor completa todos los campos requeridos');
      return;
    }

    if (!this.isValidEmail(this.email)) {
      this.error.set('Por favor ingresa un email válido');
      return;
    }

    // Password strength validation
    const passwordValidation = this.validatePassword(this.password);
    if (!passwordValidation.valid) {
      this.error.set(passwordValidation.error);
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }

    this.isLoading.set(true);

    const result = await this.authService.signUp(
      this.email,
      this.password,
      this.displayName || undefined
    );

    this.isLoading.set(false);

    if (result.success) {
      if (result.needsEmailConfirmation) {
        // Email confirmation required
        this.success.set('¡Cuenta creada! Revisa tu email para confirmar tu cuenta y luego inicia sesión.');
      } else {
        // User is logged in immediately
        this.success.set('¡Cuenta creada exitosamente! Redirigiendo...');
        setTimeout(() => {
          this.router.navigate(['/']);
        }, 1500);
      }
    } else {
      this.error.set(result.error || 'Error al crear la cuenta');
    }
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   * Requirements:
   * - At least 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   */
  private validatePassword(password: string): { valid: boolean; error: string } {
    if (password.length < 8) {
      return { valid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, error: 'La contraseña debe incluir al menos una letra mayúscula' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, error: 'La contraseña debe incluir al menos una letra minúscula' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, error: 'La contraseña debe incluir al menos un número' };
    }
    return { valid: true, error: '' };
  }

  isOfflineMode(): boolean {
    return this.authService.isOfflineMode();
  }
}
