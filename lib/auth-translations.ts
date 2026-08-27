import type { Locale } from "./i18n";

export const authTranslations = {
  es: {
    countryLabel: "Seleccionar país", countrySearch: "Buscar país", noCountries: "Sin resultados",
    loginTitle: "Bienvenido de nuevo", loginDescription: "Inicia sesión para seguir descubriendo y compartiendo recomendaciones de películas con tu comunidad.",
    username: "USUARIO", password: "CONTRASEÑA", usernamePlaceholder: "Usuario", passwordPlaceholder: "Contraseña", showPassword: "Mostrar contraseña", hidePassword: "Ocultar contraseña",
    loginButton: "Entrar", loggingIn: "Iniciando sesión…", noAccount: "¿No tienes cuenta?", signupLink: "Regístrate", continueAsGuest: "Ingresa como invitado",
    requiredUsername: "El usuario es obligatorio.", requiredPassword: "La contraseña es obligatoria.",
    credentialTitle: "No pudimos iniciar sesión", credentialMessage: "El usuario o la contraseña son incorrectos. Revisa la información e inténtalo nuevamente.",
    connectionTitle: "No pudimos conectar", connectionMessage: "Ocurrió un problema al comunicarnos con el servicio. Inténtalo nuevamente en unos minutos.", close: "Entendido",
    verified: "Tu correo fue verificado. Ya puedes iniciar sesión.", expired: "El enlace expiró. Debes crear tu cuenta nuevamente.",
    signupTitle: "Crea tu cuenta", signupDescription: "Regístrate para personalizar tu feed, puntuar películas y participar en conversaciones con otros cinéfilos.",
    firstName: "NOMBRE", lastName: "APELLIDO", email: "CORREO ELECTRÓNICO", birthDate: "FECHA DE NACIMIENTO", confirmPassword: "CONFIRMAR CONTRASEÑA",
    firstNamePlaceholder: "Tu nombre", lastNamePlaceholder: "Tu apellido", usernameSignupPlaceholder: "Mínimo 8 caracteres", emailPlaceholder: "tu@email.com", createPassword: "Crea una contraseña segura", repeatPassword: "Repite tu contraseña",
    signupButton: "Registrarme", signingUp: "Enviando confirmación…", haveAccount: "¿Ya tienes cuenta?", signinLink: "Inicia sesión",
    firstRequired: "El nombre es obligatorio.", lastRequired: "El apellido es obligatorio.", usernameMin: "El usuario debe tener al menos 8 caracteres.", birthRequired: "La fecha de nacimiento es obligatoria.", birthInvalid: "Ingresa una fecha de nacimiento válida.", minimumAge: "Debes tener al menos 13 años para registrarte.", passwordsMismatch: "Las contraseñas no coinciden.",
    checkingUsername: "Verificando usuario…", usernameAvailable: "Usuario disponible", usernameTaken: "Este usuario ya existe.", emailTaken: "Este correo ya está registrado.", passwordRequirements: "La contraseña no cumple los requisitos.", usernameCheckError: "No se pudo verificar el usuario. Intenta nuevamente.", waitUsername: "Espera a que termine la verificación del usuario.", verifyUsername: "Verifica que el usuario esté disponible antes de registrarte.", registrationError: "No se pudo completar el registro.",
    birthHelper: "Esta fecha no podrá modificarse después de crear la cuenta.", confirmBirth: "Confirmar fecha de nacimiento", selectedDate: "Fecha seleccionada:", calculatedAge: "Edad calculada:", unavailable: "No disponible", cancel: "Cancelar", modify: "Modificar", accept: "Aceptar",
    reviewEmail: "Revisa tu correo", pendingDescription: "Tu registro quedó pendiente hasta que confirmes tu correo electrónico.", confirmedAccount: "¿Ya confirmaste tu cuenta?", confirmationSent: "Te enviamos un correo de confirmación. Revisa tu bandeja para activar tu cuenta.", pendingAccount: "La cuenta permanecerá pendiente y no podrás iniciar sesión hasta abrir el enlace de confirmación.", goLogin: "Ir a iniciar sesión",
  },
  en: {
    countryLabel: "Select country", countrySearch: "Search countries", noCountries: "No results",
    loginTitle: "Welcome back", loginDescription: "Sign in to keep discovering and sharing movie recommendations with your community.",
    username: "USERNAME", password: "PASSWORD", usernamePlaceholder: "Username", passwordPlaceholder: "Password", showPassword: "Show password", hidePassword: "Hide password",
    loginButton: "Sign in", loggingIn: "Signing in…", noAccount: "Don’t have an account?", signupLink: "Sign up", continueAsGuest: "Continue as guest",
    requiredUsername: "Username is required.", requiredPassword: "Password is required.",
    credentialTitle: "We couldn’t sign you in", credentialMessage: "The username or password is incorrect. Check your information and try again.",
    connectionTitle: "We couldn’t connect", connectionMessage: "There was a problem connecting to the service. Please try again in a few minutes.", close: "Got it",
    verified: "Your email was verified. You can now sign in.", expired: "The link expired. Please create your account again.",
    signupTitle: "Create your account", signupDescription: "Sign up to personalize your feed, rate movies, and join conversations with other movie lovers.",
    firstName: "FIRST NAME", lastName: "LAST NAME", email: "EMAIL", birthDate: "DATE OF BIRTH", confirmPassword: "CONFIRM PASSWORD",
    firstNamePlaceholder: "Your first name", lastNamePlaceholder: "Your last name", usernameSignupPlaceholder: "Minimum 8 characters", emailPlaceholder: "you@email.com", createPassword: "Create a secure password", repeatPassword: "Repeat your password",
    signupButton: "Sign up", signingUp: "Sending confirmation…", haveAccount: "Already have an account?", signinLink: "Sign in",
    firstRequired: "First name is required.", lastRequired: "Last name is required.", usernameMin: "Username must be at least 8 characters.", birthRequired: "Date of birth is required.", birthInvalid: "Enter a valid date of birth.", minimumAge: "You must be at least 13 years old.", passwordsMismatch: "The passwords do not match.",
    checkingUsername: "Checking username…", usernameAvailable: "Username available", usernameTaken: "This username already exists.", emailTaken: "This email is already registered.", passwordRequirements: "The password does not meet the requirements.", usernameCheckError: "We couldn’t check the username. Try again.", waitUsername: "Wait for the username check to finish.", verifyUsername: "Verify that the username is available before signing up.", registrationError: "We couldn’t complete registration.",
    birthHelper: "This date cannot be changed after creating the account.", confirmBirth: "Confirm date of birth", selectedDate: "Selected date:", calculatedAge: "Calculated age:", unavailable: "Unavailable", cancel: "Cancel", modify: "Change", accept: "Accept",
    reviewEmail: "Check your email", pendingDescription: "Your registration is pending until you confirm your email.", confirmedAccount: "Already confirmed your account?", confirmationSent: "We sent you a confirmation email. Check your inbox to activate your account.", pendingAccount: "The account will remain pending and you cannot sign in until you open the confirmation link.", goLogin: "Go to sign in",
  },
} as const;

export function getAuthTranslations(locale: Locale) { return authTranslations[locale]; }
