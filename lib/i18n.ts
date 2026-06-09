export type Locale = "es" | "en";
export type Country = "CO" | "US";

const STORAGE_KEY = "app_locale_country";
const USER_STORAGE_KEY_PREFIX = "app_locale_country:";
const ACTIVE_SCOPE_STORAGE_KEY = "app_locale_active_scope";
export const localeEventName = "app-locale-change";

export interface LocaleUserScope {
  userId?: string | number | null;
  username?: string | null;
}

const translations = {
  es: {
    searchMovies: "Buscar películas, género o año",
    chooseGenres: "*Escoge hasta 3 géneros",
    weeklyRecs: "Recomendaciones de la semana",
    yourWatchlist: "Tu Cartelera",
    following: "Seguidos",
    myRating: "Mi Calif.",
    noPoster: "Sin poster",
    notificationsTitle: "NOTIFICACIONES",
    notificationsEmpty: "No tienes notificaciones pendientes.",
    notificationsMarkAllRead: "Marcar todo como leído",
    notificationsGoToPrivateInbox: "Ir a Buzón Privado",
    notificationsGoToMyActivity: "Ir a Mi actividad",
    notificationsGoToPending: "Ir a Pendientes",

    movieDetailTitle: "Detalle de película",
    movieDetailDirector: "Director",
    movieDetailCast: "Casting",
    movieDetailMovie: "Película",
    movieDetailSeries: "Serie",
    movieDetailUnknown: "Desconocido",
    movieDetailNoGenre: "Sin género",
    movieDetailCommentTitle: "Comentar película",
    movieDetailCommentPlaceholder: "Comparte tu recomendación... Usa @ para mencionar a un amigo",
    movieDetailMentionHelp: "Si eliges una mención del listado, se enviará como recomendación privada.",
    movieDetailValidMention: "Mención válida seleccionada",
    movieDetailNoFriendMatches: "No hay coincidencias de amigos.",
    movieDetailPost: "Publicar",
    movieDetailSending: "Enviando...",
    movieDetailPublicComments: "Comentarios públicos",
    movieDetailNoPublicComments: "Todavía no hay comentarios públicos para esta película.",
    movieDetailPublicBadge: "Público",
    movieDetailDirectedBadge: "Dirigido",
    movieDetailDirectedComments: "Comentarios dirigidos",
    movieDetailNoDirectedComments: "No hay comentarios dirigidos para esta película.",
    movieDetailNoConversationMessages: "No hay mensajes en esta conversación.",
    movieDetailReceived: "Recibido",
    movieDetailSent: "Enviado",
    movieDetailHide: "Ocultar",
    movieDetailShow: "Mostrar",
    movieDetailLoading: "Cargando...",
    movieDetailLoadingMovie: "Cargando película...",
    movieDetailLoadingComments: "Cargando comentarios...",
    movieDetailLoadingMoreComments: "Cargando más comentarios...",
    movieDetailLoadingPreviousMessages: "Cargando mensajes anteriores...",
    movieDetailLoadingFullHistory: "Cargando historial completo...",
    movieDetailMovieLoadError: "No pudimos cargar la película.",
    movieDetailMovieParseError: "No pudimos cargar la película.",
    movieDetailPublicCommentsLoadError: "No pudimos cargar los comentarios públicos.",
    movieDetailDirectedCommentsLoadError: "No pudimos cargar los comentarios dirigidos.",
    movieDetailReactionError: "No pudimos registrar tu reacción en este momento.",
    movieDetailCommentPostError: "No pudimos publicar tu comentario.",
    movieDetailNoDate: "Sin fecha",
    movieDetailLike: "Me gusta",
    movieDetailDislike: "No me gusta",
    movieDetailYouLiked: "Te gustó",
    movieDetailYouDisliked: "No te gustó",
    profileFeedUser: "Usuario",
    profileFeedAge: "{age} Años",
    profileFeedFavoriteMovies: "Mis Películas Favoritas",
    profileFeedSearchAndFollowFriends: "Buscar y Seguir Amigos",
    profileFeedSearchFavoriteMoviePlaceholder: "Buscar película favorita {slot} por título, año, género, director o cast",
    profileFeedTypeAtLeast3Characters: "Escribe al menos 3 caracteres.",
    profileFeedNoResults: "Sin resultados.",
    profileFeedLoading: "Cargando...",
    profileFeedLoadingList: "Cargando lista…",
    profileFeedNoMovies: "Sin películas",
    profileFeedNoItems: "Sin elementos",
    profileFeedFollowing: "Seguidos",
    profileFeedFollowedByOne: "Lo sigue 1 usuario",
    profileFeedFollowedByMany: "Lo siguen {count} usuarios",
    profileFeedNoFollowers: "Sin seguidores",
    profileFeedFriends: "Amigos",
    profileFeedPending: "Pendientes",
    profileFeedNoPendingRequests: "No tienes solicitudes pendientes",
    profileFeedRequestSent: "Solicitud enviada",
    profileFeedRequestReceived: "Solicitud recibida",
    profileFeedRequestAccepted: "Solicitud aceptada",
    profileFeedRequestRejected: "Solicitud rechazada",
    profileFeedMyActivity: "Mi actividad",
    profileFeedPrivateInbox: "Buzón Privado",
    profileFeedMyRatings: "Mis calificadas",
    profileFeedSearchUser: "Buscar usuario",
    profileFeedReceived: "Recibido",
    profileFeedSent: "Enviado",
    profileFeedReceivedFrom: "Recibido de",
    profileFeedSentTo: "Enviado a",
    profileFeedNoMessages: "Sin mensajes",
    profileFeedHide: "Ocultar",
    profileFeedShow: "Mostrar",
    profileFeedViewMore: "Ver más",
    profileFeedViewLess: "Ver menos",
    profileFeedMyList: "Mi Lista",
    profileFeedMyRecommendations: "Mis recomendadas",
    profileFeedRecommendations: "Recomendadas",
    profileFeedRated: "calificó",
    profileFeedCommented: "Comentó",
    profileFeedType: "Tipo:",
    profileFeedGenre: "Género:",
    profileFeedDirector: "Director:",
    profileFeedCast: "Casting:",
    profileFeedGeneral: "General",
    profileFeedMyRatingUpper: "MI CALIF.",
    profileFeedOneRating: "1 calif.",
    profileFeedManyRatings: "{count} calif.",
    profileFeedMovieTypeMovie: "movie",
    profileFeedMovieTypeSeries: "series",
    profileFeedRecent: "Reciente",
    profileFeedNow: "Ahora",
    profileFeedUnknownTitle: "Título desconocido",
    profileFeedNoPoster: "Sin poster",
    profileFeedRetry: "Reintentar",
    profileFeedLoadMore: "Cargar más resultados",
    profileFeedLoadingMoreUsers: "Cargando más usuarios…",
    profileFeedLoadingMoreActivity: "Cargando más actividad...",
    profileFeedLoadingMoreMessages: "Cargando más mensajes...",
    profileFeedLoadingMore: "Cargando más...",
    profileFeedNoUsersFound: "No encontramos usuarios",
    profileFeedSearchingUsers: "Buscando usuarios…",
    profileFeedYouRatedMovie: "Calificaste con {rating} esta película",
    profileFeedRatedMovie: "Calificó con {rating} esta película",
    profileFeedYouLikedCommentFrom: "Te gustó el comentario de {username}",
    profileFeedYouDislikedCommentFrom: "No te gustó el comentario de {username}",
    profileFeedUserLikedYourComment: "A {username} le gustó tu comentario",
    profileFeedUserDislikedYourComment: "A {username} no le gustó tu comentario",
    visitedProfileBackToMyProfile: "← Volver a mi perfil",
    visitedProfileUser: "USUARIO",
    visitedProfileAge: "{age} Años",
    visitedProfileFavoriteMovies: "Favoritas de {name}",
    visitedProfileFollowing: "Siguiendo",
    visitedProfileFollow: "Seguir",
    visitedProfileFriends: "Amigos",
    visitedProfileFriendRequest: "Solicitud de amistad",
    visitedProfileFriendRequestReceived: "Solicitud recibida",
    visitedProfileSent: "Enviada",
    visitedProfileActivity: "Actividad de {name}",
    visitedProfileRecommendations: "Recomendaciones",
    visitedProfilePublicComments: "Comentarios públicos",
    visitedProfileRatings: "Calificaciones",
    visitedProfileLikesDislikes: "Me gusta/No me gusta",
    visitedProfileMovieTypeMovie: "Película",
    visitedProfileMovieTypeSeries: "Serie",
    profileFeedMyListRemoveAria: "Quitar {title} de Mi Lista",
    profileFeedMyRecommendationsRemoveAria: "Quitar {title} de Mis recomendadas",
    personalData: "Datos Personales",
    personalDataSubtitle: "Gestiona aquí tu información principal de perfil.",
    personalDataBasicInfo: "Información básica",
    personalDataFirstName: "Nombre",
    personalDataLastName: "Apellido",
    personalDataEmail: "Email",
    personalDataPersonalInfo: "Información personal",
    personalDataBirthDate: "Fecha de nacimiento",
    personalDataAge: "Edad",
    personalDataVisible: "Visible",
    personalDataLockedBirthDate: "La fecha de nacimiento ya fue confirmada y no puede modificarse.",
    personalDataGenderIdentity: "Identidad de género",
    personalDataPhotoAvatar: "Foto/Avatar",
    personalDataUploadPhoto: "Subir o cambiar foto",
    personalDataChooseFile: "Elegir archivo",
    personalDataNoFileSelected: "Sin archivo seleccionado",
    personalDataSelectedFile: "Archivo seleccionado",
    personalDataSaveChanges: "Guardar cambios",
    personalDataYes: "Sí",
    personalDataNo: "No",
    personalDataSelectOption: "Selecciona una opción",
    personalDataGenderMan: "Hombre",
    personalDataGenderWoman: "Mujer",
    personalDataGenderNonBinary: "No binario",
    personalDataGenderPreferNotToSay: "Prefiero no decirlo",
    policies: "Políticas y Términos",
    privacySecurity: "Privacidad y Seguridad",
    privacySecurityConditionsTitle: "CONDICIONES DE PRIVACIDAD",
    privacySecurityConditionDefaultPublic: "Todos los perfiles se crean como públicos por defecto, pero puedes cambiar esta configuración cuando quieras.",
    privacySecurityConditionPublicProfiles: "Los perfiles públicos pueden recibir seguidores, seguir perfiles públicos y también tener amistades.",
    privacySecurityConditionPrivateProfiles: "Los perfiles privados no pueden ser seguidos, pero sí pueden seguir perfiles públicos y mantener amistades.",
    privacySecurityConditionPrivateChange: "Si cambias tu perfil a privado, perderás tus seguidores actuales, pero conservarás los perfiles que ya sigues.",
    privacySecurityConditionPublicComments: "Tus comentarios públicos seguirán siendo visibles aunque tu perfil sea privado.",
    privacySecurityConditionRestrictedUser: "Si restringes a un usuario, esa persona no podrá acceder a tu perfil ni al contenido que el backend le oculte por restricción.",
    privacySecurityConditionFriendRequests: "El perfil público que restrinja solicitudes de amistad conservará sus seguidores y seguidos, pero perderá todas sus amistades actuales. Si vuelve a permitir solicitudes, esas amistades no se recuperarán automáticamente.",
    privacySecurityProfileType: "Tipo de perfil",
    privacySecurityPublic: "Público",
    privacySecurityPrivate: "Privado",
    privacySecurityPublicDescription: "Puede recibir seguidores y mantener amistades.",
    privacySecurityPrivateDescription: "No puede ser seguido, pero sí mantener amistades.",
    privacySecurityRestrictFriendRequests: "Restringir solicitudes de amistad",
    privacySecurityRestrictFriendRequestsDescription: "Controla si otros usuarios pueden enviarte solicitudes de amistad.",
    privacySecurityConfirmFriendRequestsRestrictionDescription: "Al restringir las solicitudes de amistad, se eliminarán todas tus amistades actuales. Podrás volver a permitir solicitudes más adelante, pero las amistades eliminadas no se recuperarán automáticamente; tendrás que agregarlas nuevamente una por una.",
    privacySecurityYes: "Sí",
    privacySecurityNo: "No",
    privacySecurityConfirmPrivateTitle: "Confirmar cambio a perfil privado",
    privacySecurityConfirmPrivateDescription: "Al cambiar tu perfil a privado, tus seguidores actuales serán eliminados. Seguirás conservando los perfiles que ya sigues y podrás seguir interactuando públicamente en películas. Tus amistades no se verán afectadas. ¿Deseas continuar?",
    privacySecurityCancel: "Cancelar",
    privacySecurityAccept: "Aceptar",
    privacySecurityConfirmChange: "Confirmar cambio",
    privacySecurityRestrictUsers: "Restringir usuarios",
    privacySecuritySearchUserPlaceholder: "Buscar usuario por nombre",
    privacySecuritySearch: "Buscar",
    privacySecuritySearching: "Buscando...",
    privacySecurityResults: "RESULTADOS",
    privacySecurityAdd: "Agregar",
    privacySecurityNoResults: "Sin resultados",
    privacySecurityRestrictedUsers: "USUARIOS RESTRINGIDOS",
    privacySecurityNoRestrictedUsers: "No tienes usuarios restringidos actualmente.",
    privacySecurityRemoveRestriction: "Quitar restricción",
    privacySecurityLoading: "Cargando...",
    privacySecuritySavingChanges: "Guardando cambios...",
    privacySecuritySearchingUsers: "Buscando usuarios...",
    privacySecurityLoadingRestrictedUsers: "Cargando usuarios restringidos...",
    privacySecurityPrivacySettingsLoadError: "No se pudo cargar tu configuración de privacidad.",
    privacySecurityRestrictedUsersLoadError: "No se pudo cargar la lista de usuarios restringidos.",
    privacySecurityPrivacyUpdated: "Configuración de privacidad actualizada correctamente.",
    privacySecurityProfileTypeUpdateError: "No se pudo actualizar el tipo de perfil. Inténtalo de nuevo.",
    privacySecurityFriendRequestsUpdateError: "No se pudo actualizar la restricción de solicitudes. Inténtalo de nuevo.",
    privacySecuritySearchError: "No se pudo completar la búsqueda de usuarios.",
    privacySecurityAlreadyRestricted: "Ese usuario ya está restringido.",
    privacySecurityUserRestricted: "{username} fue restringido correctamente.",
    privacySecurityRestrictUserError: "No se pudo restringir ese usuario.",
    privacySecurityRestrictionRemoved: "Se quitó la restricción de {username}.",
    privacySecurityRemoveRestrictionError: "No se pudo quitar la restricción en este momento.",
    logout: "Cerrar Sesión",
  },
  en: {
    searchMovies: "Search movies, genre or year",
    chooseGenres: "*Choose up to 3 genres",
    weeklyRecs: "Weekly Recommendations",
    yourWatchlist: "Your Watchlist",
    following: "Following",
    myRating: "My Rating",
    noPoster: "No Poster",
    notificationsTitle: "NOTIFICATIONS",
    notificationsEmpty: "You have no pending notifications.",
    notificationsMarkAllRead: "Mark all as read",
    notificationsGoToPrivateInbox: "Go to Private Inbox",
    notificationsGoToMyActivity: "Go to My Activity",
    notificationsGoToPending: "Go to Pending",

    movieDetailTitle: "Movie Details",
    movieDetailDirector: "Director",
    movieDetailCast: "Cast",
    movieDetailMovie: "Movie",
    movieDetailSeries: "Series",
    movieDetailUnknown: "Unknown",
    movieDetailNoGenre: "No genre",
    movieDetailCommentTitle: "Comment on Movie",
    movieDetailCommentPlaceholder: "Share your recommendation... Use @ to mention a friend",
    movieDetailMentionHelp: "If you select a mention from the list, it will be sent as a private recommendation.",
    movieDetailValidMention: "Valid mention selected",
    movieDetailNoFriendMatches: "No friend matches.",
    movieDetailPost: "Post",
    movieDetailSending: "Sending...",
    movieDetailPublicComments: "Public Comments",
    movieDetailNoPublicComments: "There are no public comments for this movie yet.",
    movieDetailPublicBadge: "Public",
    movieDetailDirectedBadge: "Directed",
    movieDetailDirectedComments: "Directed Comments",
    movieDetailNoDirectedComments: "There are no directed comments for this movie.",
    movieDetailNoConversationMessages: "There are no messages in this conversation.",
    movieDetailReceived: "Received",
    movieDetailSent: "Sent",
    movieDetailHide: "Hide",
    movieDetailShow: "Show",
    movieDetailLoading: "Loading...",
    movieDetailLoadingMovie: "Loading movie...",
    movieDetailLoadingComments: "Loading comments...",
    movieDetailLoadingMoreComments: "Loading more comments...",
    movieDetailLoadingPreviousMessages: "Loading previous messages...",
    movieDetailLoadingFullHistory: "Loading full history...",
    movieDetailMovieLoadError: "We couldn’t load this movie.",
    movieDetailMovieParseError: "We couldn’t load this movie.",
    movieDetailPublicCommentsLoadError: "We couldn’t load public comments.",
    movieDetailDirectedCommentsLoadError: "We couldn’t load directed comments.",
    movieDetailReactionError: "We couldn’t register your reaction right now.",
    movieDetailCommentPostError: "We couldn’t post your comment.",
    movieDetailNoDate: "No date",
    movieDetailLike: "Like",
    movieDetailDislike: "Dislike",
    movieDetailYouLiked: "You liked",
    movieDetailYouDisliked: "You disliked",
    profileFeedUser: "User",
    profileFeedAge: "{age} years old",
    profileFeedFavoriteMovies: "My Favorite Movies",
    profileFeedSearchAndFollowFriends: "Search and Follow Friends",
    profileFeedSearchFavoriteMoviePlaceholder: "Search favorite movie {slot} by title, year, genre, director or cast",
    profileFeedTypeAtLeast3Characters: "Type at least 3 characters.",
    profileFeedNoResults: "No results.",
    profileFeedLoading: "Loading...",
    profileFeedLoadingList: "Loading list…",
    profileFeedNoMovies: "No movies",
    profileFeedNoItems: "No items",
    profileFeedFollowing: "Following",
    profileFeedFollowedByOne: "Followed by 1 user",
    profileFeedFollowedByMany: "Followed by {count} users",
    profileFeedNoFollowers: "No followers",
    profileFeedFriends: "Friends",
    profileFeedPending: "Pending",
    profileFeedNoPendingRequests: "You have no pending requests",
    profileFeedRequestSent: "Request sent",
    profileFeedRequestReceived: "Request received",
    profileFeedRequestAccepted: "Request accepted",
    profileFeedRequestRejected: "Request rejected",
    profileFeedMyActivity: "My Activity",
    profileFeedPrivateInbox: "Private Inbox",
    profileFeedMyRatings: "My Ratings",
    profileFeedSearchUser: "Search user",
    profileFeedReceived: "Received",
    profileFeedSent: "Sent",
    profileFeedReceivedFrom: "Received from",
    profileFeedSentTo: "Sent to",
    profileFeedNoMessages: "No messages",
    profileFeedHide: "Hide",
    profileFeedShow: "Show",
    profileFeedViewMore: "View more",
    profileFeedViewLess: "View less",
    profileFeedMyList: "My List",
    profileFeedMyRecommendations: "My Recommendations",
    profileFeedRecommendations: "Recommendations",
    profileFeedRated: "rated",
    profileFeedCommented: "Commented",
    profileFeedType: "Type:",
    profileFeedGenre: "Genre:",
    profileFeedDirector: "Director:",
    profileFeedCast: "Cast:",
    profileFeedGeneral: "General",
    profileFeedMyRatingUpper: "MY RATING",
    profileFeedOneRating: "1 rating",
    profileFeedManyRatings: "{count} ratings",
    profileFeedMovieTypeMovie: "Movie",
    profileFeedMovieTypeSeries: "Series",
    profileFeedRecent: "Recent",
    profileFeedNow: "Now",
    profileFeedUnknownTitle: "Unknown title",
    profileFeedNoPoster: "No poster",
    profileFeedRetry: "Retry",
    profileFeedLoadMore: "Load more results",
    profileFeedLoadingMoreUsers: "Loading more users…",
    profileFeedLoadingMoreActivity: "Loading more activity...",
    profileFeedLoadingMoreMessages: "Loading more messages...",
    profileFeedLoadingMore: "Loading more...",
    profileFeedNoUsersFound: "No users found",
    profileFeedSearchingUsers: "Searching users…",
    profileFeedYouRatedMovie: "You rated this movie {rating}",
    profileFeedRatedMovie: "Rated this movie {rating}",
    profileFeedYouLikedCommentFrom: "You liked the comment from {username}",
    profileFeedYouDislikedCommentFrom: "You disliked the comment from {username}",
    profileFeedUserLikedYourComment: "{username} liked your comment",
    profileFeedUserDislikedYourComment: "{username} disliked your comment",
    visitedProfileBackToMyProfile: "← Back to my profile",
    visitedProfileUser: "USER",
    visitedProfileAge: "{age} years old",
    visitedProfileFavoriteMovies: "{name}'s Favorites",
    visitedProfileFollowing: "Following",
    visitedProfileFollow: "Follow",
    visitedProfileFriends: "Friends",
    visitedProfileFriendRequest: "Friend Request",
    visitedProfileFriendRequestReceived: "Friend Request",
    visitedProfileSent: "Sent",
    visitedProfileActivity: "{name}'s Activity",
    visitedProfileRecommendations: "Recommendations",
    visitedProfilePublicComments: "Public Comments",
    visitedProfileRatings: "Ratings",
    visitedProfileLikesDislikes: "Likes/Dislikes",
    visitedProfileMovieTypeMovie: "Movie",
    visitedProfileMovieTypeSeries: "Series",
    profileFeedMyListRemoveAria: "Remove {title} from My List",
    profileFeedMyRecommendationsRemoveAria: "Remove {title} from My Recommendations",
    personalData: "Personal Data",
    personalDataSubtitle: "Manage your main profile information here.",
    personalDataBasicInfo: "Basic Information",
    personalDataFirstName: "First Name",
    personalDataLastName: "Last Name",
    personalDataEmail: "Email",
    personalDataPersonalInfo: "Personal Information",
    personalDataBirthDate: "Date of Birth",
    personalDataAge: "Age",
    personalDataVisible: "Visible",
    personalDataLockedBirthDate: "Your date of birth has already been confirmed and cannot be changed.",
    personalDataGenderIdentity: "Gender Identity",
    personalDataPhotoAvatar: "Photo/Avatar",
    personalDataUploadPhoto: "Upload or change photo",
    personalDataChooseFile: "Choose file",
    personalDataNoFileSelected: "No file selected",
    personalDataSelectedFile: "Selected file",
    personalDataSaveChanges: "Save Changes",
    personalDataYes: "Yes",
    personalDataNo: "No",
    personalDataSelectOption: "Select an option",
    personalDataGenderMan: "Man",
    personalDataGenderWoman: "Woman",
    personalDataGenderNonBinary: "Non-binary",
    personalDataGenderPreferNotToSay: "Prefer not to say",
    policies: "Policies & Terms",
    privacySecurity: "Privacy & Security",
    privacySecurityConditionsTitle: "PRIVACY CONDITIONS",
    privacySecurityConditionDefaultPublic: "All profiles are created as public by default, but you can change this setting whenever you want.",
    privacySecurityConditionPublicProfiles: "Public profiles can receive followers, follow public profiles, and also have friendships.",
    privacySecurityConditionPrivateProfiles: "Private profiles cannot be followed, but they can follow public profiles and keep friendships.",
    privacySecurityConditionPrivateChange: "If you change your profile to private, you will lose your current followers, but you will keep the profiles you already follow.",
    privacySecurityConditionPublicComments: "Your public comments will remain visible even if your profile is private.",
    privacySecurityConditionRestrictedUser: "If you restrict a user, that person will not be able to access your profile or any content hidden from them by the backend restriction.",
    privacySecurityConditionFriendRequests: "A public profile that restricts friend requests will keep its followers and following, but will lose all current friendships. If friend requests are allowed again, those friendships will not be restored automatically.",
    privacySecurityProfileType: "Profile Type",
    privacySecurityPublic: "Public",
    privacySecurityPrivate: "Private",
    privacySecurityPublicDescription: "Can receive followers and keep friendships.",
    privacySecurityPrivateDescription: "Cannot be followed, but can keep friendships.",
    privacySecurityRestrictFriendRequests: "Restrict Friend Requests",
    privacySecurityRestrictFriendRequestsDescription: "Control whether other users can send you friend requests.",
    privacySecurityConfirmFriendRequestsRestrictionDescription: "By restricting friend requests, all your current friendships will be removed. You will be able to allow requests again later, but removed friendships will not be restored automatically; you will have to add them again one by one.",
    privacySecurityYes: "Yes",
    privacySecurityNo: "No",
    privacySecurityConfirmPrivateTitle: "Confirm Change to Private Profile",
    privacySecurityConfirmPrivateDescription: "By changing your profile to private, your current followers will be removed. You will keep the profiles you already follow and will still be able to interact publicly on movies. Your friendships will not be affected. Do you want to continue?",
    privacySecurityCancel: "Cancel",
    privacySecurityAccept: "Accept",
    privacySecurityConfirmChange: "Confirm Change",
    privacySecurityRestrictUsers: "Restrict Users",
    privacySecuritySearchUserPlaceholder: "Search user by name",
    privacySecuritySearch: "Search",
    privacySecuritySearching: "Searching...",
    privacySecurityResults: "RESULTS",
    privacySecurityAdd: "Add",
    privacySecurityNoResults: "No results",
    privacySecurityRestrictedUsers: "RESTRICTED USERS",
    privacySecurityNoRestrictedUsers: "You currently have no restricted users.",
    privacySecurityRemoveRestriction: "Remove restriction",
    privacySecurityLoading: "Loading...",
    privacySecuritySavingChanges: "Saving changes...",
    privacySecuritySearchingUsers: "Searching users...",
    privacySecurityLoadingRestrictedUsers: "Loading restricted users...",
    privacySecurityPrivacySettingsLoadError: "Your privacy settings could not be loaded.",
    privacySecurityRestrictedUsersLoadError: "The restricted users list could not be loaded.",
    privacySecurityPrivacyUpdated: "Privacy settings were successfully updated.",
    privacySecurityProfileTypeUpdateError: "The profile type could not be updated. Please try again.",
    privacySecurityFriendRequestsUpdateError: "The request restriction could not be updated. Please try again.",
    privacySecuritySearchError: "The user search could not be completed.",
    privacySecurityAlreadyRestricted: "That user is already restricted.",
    privacySecurityUserRestricted: "{username} was successfully restricted.",
    privacySecurityRestrictUserError: "That user could not be restricted.",
    privacySecurityRestrictionRemoved: "The restriction was removed from {username}.",
    privacySecurityRemoveRestrictionError: "The restriction could not be removed right now.",
    logout: "Log Out",
  },
} as const;

type TranslationKey = keyof typeof translations.es;

export function countryToLocale(country: Country): Locale { return country === "US" ? "en" : "es"; }
export function localeToCountry(locale: Locale): Country { return locale === "en" ? "US" : "CO"; }

function normalizeUsername(username?: string | null): string | null {
  if (typeof username !== "string") return null;
  const normalized = username.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolveLocaleScope(scope?: LocaleUserScope | null): string | null {
  if (!scope) return null;
  if (scope.userId !== null && scope.userId !== undefined) {
    const normalizedId = String(scope.userId).trim();
    if (normalizedId) return `id:${normalizedId}`;
  }

  const normalizedUsername = normalizeUsername(scope.username);
  return normalizedUsername ? `username:${normalizedUsername}` : null;
}

function buildScopedStorageKey(scopeKey: string): string {
  return `${USER_STORAGE_KEY_PREFIX}${scopeKey}`;
}

function getActiveScopeKey(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ACTIVE_SCOPE_STORAGE_KEY);
  return value?.trim() || null;
}

export function setActiveLocaleScope(scope?: LocaleUserScope | null): Country {
  if (typeof window === "undefined") return "CO";
  const scopeKey = resolveLocaleScope(scope);
  if (!scopeKey) {
    window.localStorage.removeItem(ACTIVE_SCOPE_STORAGE_KEY);
  } else {
    window.localStorage.setItem(ACTIVE_SCOPE_STORAGE_KEY, scopeKey);
  }
  const country = getStoredCountry(scope);
  window.dispatchEvent(new CustomEvent(localeEventName, { detail: { country, locale: countryToLocale(country), scopeKey } }));
  return country;
}

export function getStoredCountry(scope?: LocaleUserScope | null): Country {
  if (typeof window === "undefined") return "CO";
  const scopeKey = resolveLocaleScope(scope) ?? getActiveScopeKey();
  const value = scopeKey
    ? window.localStorage.getItem(buildScopedStorageKey(scopeKey)) ?? window.localStorage.getItem(STORAGE_KEY)
    : window.localStorage.getItem(STORAGE_KEY);
  return value === "US" ? "US" : "CO";
}

export function setStoredCountry(country: Country, scope?: LocaleUserScope | null) {
  if (typeof window === "undefined") return;
  const scopeKey = resolveLocaleScope(scope);
  if (scopeKey) {
    window.localStorage.setItem(buildScopedStorageKey(scopeKey), country);
    window.localStorage.setItem(ACTIVE_SCOPE_STORAGE_KEY, scopeKey);
  } else {
    window.localStorage.setItem(STORAGE_KEY, country);
  }
  window.dispatchEvent(new CustomEvent(localeEventName, { detail: { country, locale: countryToLocale(country), scopeKey } }));
}

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] ?? translations.es[key] ?? key;
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function formatProfileFeedRelativeDate(locale: Locale, iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t(locale, "profileFeedRecent");

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);

  if (elapsedMinutes < 1) return t(locale, "profileFeedNow");
  if (elapsedMinutes < 60) return locale === "en" ? `${elapsedMinutes} min ago` : `Hace ${elapsedMinutes} min`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return locale === "en" ? `${elapsedHours} h ago` : `Hace ${elapsedHours} h`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) return locale === "en" ? `${elapsedDays} d ago` : `Hace ${elapsedDays} d`;

  return formatProfileFeedAbsoluteDate(locale, date);
}

export function formatProfileFeedAbsoluteDate(locale: Locale, date: Date): string {
  const months = locale === "en"
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()] ?? "";
  const year = date.getFullYear();
  return locale === "en" ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
}

export function formatProfileFeedRatingsCount(locale: Locale, count: number | null | undefined): string | null {
  const normalizedCount = typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (normalizedCount <= 0) return null;
  return interpolate(t(locale, normalizedCount === 1 ? "profileFeedOneRating" : "profileFeedManyRatings"), { count: normalizedCount });
}

export function translateProfileFeedMovieType(locale: Locale, value?: string | null): string {
  const normalized = value?.trim().toLocaleLowerCase();
  if (normalized === "movie") return t(locale, "profileFeedMovieTypeMovie");
  if (normalized === "series") return t(locale, "profileFeedMovieTypeSeries");
  return value || "-";
}

export function translateVisitedProfileMovieType(locale: Locale, value?: string | null): string {
  const normalized = value?.trim().toLocaleLowerCase();
  if (normalized === "movie") return t(locale, "visitedProfileMovieTypeMovie");
  if (normalized === "series") return t(locale, "visitedProfileMovieTypeSeries");
  return value || "-";
}

export function translateVisibleGenre(locale: Locale, value?: string | null): string {
  const normalized = value?.trim();
  if (!normalized) return "-";
  if (locale === "en") return normalized;

  const genreTranslations: Record<string, string> = {
    Action: "Acción",
    Animation: "Animación",
    Comedy: "Comedia",
    Documentary: "Documental",
    Drama: "Drama",
    Horror: "Horror",
    Musical: "Musical",
    "Sci-Fi": "Ciencia ficción",
  };

  return genreTranslations[normalized] ?? normalized;
}

export function translateVisibleGenres(locale: Locale, values?: string[] | string | null): string {
  const genres = Array.isArray(values) ? values : typeof values === "string" ? values.split(",") : [];
  const translated = genres.map((genre) => translateVisibleGenre(locale, genre.trim())).filter((genre) => genre !== "-");
  return translated.length ? translated.join(", ") : "-";
}

export function resolveMovieTitles(locale: Locale, titleSpanish?: string | null, titleEnglish?: string | null, fallback?: string | null) {
  const es = titleSpanish?.trim() || null;
  const en = titleEnglish?.trim() || null;
  const base = fallback?.trim() || null;
  const primary = locale === "en" ? en ?? es ?? base ?? "Sin título" : es ?? en ?? base ?? "Sin título";
  const secondaryCandidate = locale === "en" ? es : en;
  const secondary = secondaryCandidate && secondaryCandidate !== primary ? secondaryCandidate : null;
  return { primary, secondary };
}

export function resolveSynopsis(locale: Locale, synopsis?: string | null, synopsisEs?: string | null) {
  if (locale === "en") return synopsis?.trim() || synopsisEs?.trim() || "";
  return synopsisEs?.trim() || synopsis?.trim() || "";
}
